import { randomUUID } from 'node:crypto';
import { test as base } from 'vitest';
import { prisma } from '@/shared/server/db';
import { cleanTestData, integrationDatabaseUrl } from './database';

async function createCourse(code: string, [teacherId, studentId, classmateId]: string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.user.createMany({
      data: [teacherId, studentId, classmateId].map((id) => ({
        id,
        name: id === teacherId ? 'Docente' : 'Estudiante',
        institutionalEmail: `${id}@notifications.u-roadmaps.test`,
        rut: id.slice(0, 20),
      })),
    });
    const course = await tx.course.create({
      data: {
        code,
        name: 'Curso de prueba',
        department: 'Computación',
        courseOfferings: {
          create: {
            year: 2026,
            semester: 2,
            participants: {
              create: [
                { userId: teacherId, role: 'TEACHER' },
                { userId: studentId, role: 'STUDENT' },
                { userId: classmateId, role: 'STUDENT' },
              ],
            },
            roadmap: { create: {} },
          },
        },
      },
      include: { courseOfferings: { include: { roadmap: true, participants: true } } },
    });
    const offering = course.courseOfferings[0];
    const roadmapId = offering.roadmap!.id;
    const type = await tx.nodeType.create({
      data: { name: 'Tema', normalizedName: 'tema', icon: 'BookOpen', color: '#024AD8', roadmapId },
    });
    const node = await tx.roadmapNode.create({
      data: { title: 'Recursividad', roadmapId, nodeTypeId: type.id, positionX: 0, positionY: 0 },
    });
    const identifier = { courseCode: code, year: 2026, semester: 2 };
    return {
      studentId,
      classmateId,
      teacherId,
      roadmapId,
      nodeTypeId: type.id,
      identifier,
      participationId: offering.participants.find((p) => p.userId === studentId)!.id,
      change: { ...identifier, nodeId: node.id },
    };
  });
}

export type IntegrationCourse = Awaited<ReturnType<typeof createCourse>>;

export const test = base.extend<{ course: IntegrationCourse }>({
  course: async ({ task }, provide) => {
    void task;
    const code = `NT-${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const users = [randomUUID(), randomUUID(), randomUUID()];
    try {
      await provide(await createCourse(code, users));
    } finally {
      await cleanTestData(integrationDatabaseUrl(), code, users);
    }
  },
});
