import { afterAll, expect, vi } from 'vitest';
import type { PoolConfig } from 'pg';
import { test } from './fixtures';
import { prisma } from '@/shared/server/db';
import { synchronizeAcademicParticipations } from '@/features/roadmap/application/academic-participation';
import type { RoadmapChanges } from '@/features/roadmap/application/change-port';

vi.mock('@prisma/adapter-pg', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/adapter-pg')>();
  return {
    ...original,
    PrismaPg: class extends original.PrismaPg {
      constructor(config: PoolConfig) {
        super({ ...config, max: 1 });
      }
    },
  };
});

const { academicCourses } = vi.hoisted(() => ({ academicCourses: vi.fn() }));
vi.mock('@/integrations/ucampus/server', () => ({ getMufasaAcademicCourses: academicCourses }));

afterAll(() => prisma.$disconnect());

test('a complete academic history synchronizes with a constrained connection pool', async ({
  course,
}) => {
  const courses = Array.from({ length: 10 }, (_, index) => ({
    courseCode: course.identifier.courseCode,
    name: 'Curso de prueba',
    year: 2000 + index,
    semester: 1,
    institutionalPosition: 'COURSE_PROFESSOR' as const,
  }));
  for (const offering of courses) {
    await prisma.courseOffering.create({
      data: {
        courseCode: offering.courseCode,
        year: offering.year,
        semester: offering.semester,
        participants: { create: { userId: course.studentId, role: 'STUDENT' } },
        roadmap: { create: {} },
      },
    });
  }
  const source = {
    source: 'MUFASA',
    isComplete: true,
    courses: [...courses, { ...courses[0], institutionalPosition: 'OBSERVER' }],
  };
  academicCourses.mockResolvedValue(source);
  const reported: RoadmapChanges[] = [];
  const result = await synchronizeAcademicParticipations(
    { id: course.studentId, rut: null },
    {
      async report(transaction, changes) {
        await transaction.$executeRaw`SELECT pg_sleep(0.3)`;
        reported.push(changes);
      },
    },
  );
  expect(result).toEqual(source);
  expect(reported).toHaveLength(courses.length);
  expect(
    await prisma.participation.count({
      where: {
        userId: course.studentId,
        role: 'TEACHER',
        institutionalPosition: 'COURSE_PROFESSOR',
        courseOffering: { courseCode: course.identifier.courseCode, year: { gte: 2000, lt: 2010 } },
      },
    }),
  ).toBe(courses.length);
});
