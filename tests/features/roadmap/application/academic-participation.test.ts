import { expect, it, vi } from 'vitest';

vi.mock('@/shared/server/db', () => ({ prisma: {} }));

import {
  academicRole,
  canEditRoadmap,
  readMufasaCourseAccess,
} from '@/features/roadmap/application/academic-participation';
import {
  isCourseLeadPosition,
  localFixtureUCampus,
  type AcademicHistory,
  type MufasaEnrolledCourse,
} from '@/integrations/ucampus/server';

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
function userWith(history: AcademicHistory) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    rut: '19039752',
    ucampus: { ...localFixtureUCampus, getAcademicHistory: async () => history },
  };
}

function reported(course: Partial<MufasaEnrolledCourse>): MufasaEnrolledCourse {
  return {
    ...identifier,
    semester: 2,
    name: 'Metodologías de Diseño y Programación',
    section: '1',
    ramoId: 675,
    isTeaching: true,
    institutionalPosition: 'STUDENT',
    ...course,
  };
}

it.each([
  ['COURSE_PROFESSOR', 'TEACHER', true, true],
  ['COORDINATING_PROFESSOR', 'TEACHER', true, false],
  ['AUXILIARY_PROFESSOR', 'TEACHER', true, false],
  ['TEACHING_ASSISTANT', 'TEACHER', true, false],
  ['OBSERVER', 'STUDENT', false, false],
  [null, 'STUDENT', false, false],
] as const)('derives permissions for %s', (position, role, edit, create) => {
  const access = { name: 'Curso', positions: position ? [position] : [] };
  expect(academicRole(access)).toBe(role);
  expect(canEditRoadmap(access)).toBe(edit);
  expect(isCourseLeadPosition(position)).toBe(create);
});

it.each([
  [['OBSERVER', 'TEACHING_ASSISTANT'], 'TEACHER'],
  [['TEACHING_ASSISTANT', 'AUXILIARY_PROFESSOR'], 'TEACHER'],
  [['COORDINATING_PROFESSOR', 'COURSE_PROFESSOR'], 'TEACHER'],
] as const)('uses the highest applicable rights for %s', (positions, role) => {
  const access = { name: 'Curso', positions };
  expect(academicRole(access)).toBe(role);
});

it('collects every position the person holds in one course offering', async () => {
  const user = userWith({
    status: 'complete',
    courses: [
      reported({ section: '1', institutionalPosition: 'COURSE_PROFESSOR' }),
      reported({ section: '2', institutionalPosition: 'AUXILIARY_PROFESSOR' }),
      reported({ year: 2025, institutionalPosition: 'COURSE_PROFESSOR' }),
    ],
  });

  await expect(readMufasaCourseAccess(user, identifier)).resolves.toEqual({
    isComplete: true,
    access: {
      name: 'Metodologías de Diseño y Programación',
      positions: ['COURSE_PROFESSOR', 'AUXILIARY_PROFESSOR'],
    },
  });
});

it('reports no access when a complete history does not place the person in the offering', async () => {
  const user = userWith({ status: 'complete', courses: [reported({ year: 2025, semester: 1 })] });

  await expect(readMufasaCourseAccess(user, identifier)).resolves.toEqual({
    access: null,
    isComplete: true,
  });
});

it.each([
  ['partial', { status: 'partial', courses: [reported({})] }],
  ['unavailable', { status: 'unavailable' }],
] as const)('reports no complete answer for a %s history', async (_, history) => {
  await expect(readMufasaCourseAccess(userWith(history), identifier)).resolves.toEqual({
    access: null,
    isComplete: false,
  });
});
