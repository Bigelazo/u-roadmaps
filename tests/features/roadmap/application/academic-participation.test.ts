import 'dotenv/config';
import { expect } from 'vitest';
import { test, type IntegrationCourse } from '../../../notifications-integration/fixtures';
import { recordingChangePort } from '../support/recording-change-port';
import { prisma } from '@/shared/server/db';
import {
  academicRole,
  canEditRoadmap,
  synchronizeCourseOffering,
} from '@/features/roadmap/application/academic-participation';
import { requireRoadmapCreationAccess } from '@/features/roadmap/application/participation';
import {
  isCourseLeadPosition,
  localFixtureUCampus,
  type AcademicHistory,
  type MufasaEnrolledCourse,
} from '@/integrations/ucampus/server';

test.each([
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

test.each([
  [['OBSERVER', 'TEACHING_ASSISTANT'], 'TEACHER'],
  [['TEACHING_ASSISTANT', 'AUXILIARY_PROFESSOR'], 'TEACHER'],
  [['COORDINATING_PROFESSOR', 'COURSE_PROFESSOR'], 'TEACHER'],
] as const)('uses the highest applicable rights for %s', (positions, role) => {
  expect(academicRole({ name: 'Curso', positions })).toBe(role);
});

type Reported = Partial<Omit<MufasaEnrolledCourse, 'semester'>> &
  Pick<MufasaEnrolledCourse, 'courseCode' | 'year'> & { semester?: number };

function reported({ semester = 2, ...course }: Reported): MufasaEnrolledCourse {
  return {
    name: 'Curso de prueba',
    section: '1',
    ramoId: null,
    isTeaching: false,
    institutionalPosition: 'STUDENT',
    ...course,
    semester: semester as 1 | 2,
  };
}

function userWith(id: string, history: AcademicHistory) {
  return {
    id,
    rut: id.slice(0, 20),
    ucampus: { ...localFixtureUCampus, getAcademicHistory: async () => history },
  };
}

const complete = (...courses: Reported[]): AcademicHistory => ({
  status: 'complete',
  courses: courses.map(reported),
});

const earlier = ({ identifier }: IntegrationCourse) => ({
  ...identifier,
  year: identifier.year - 1,
});

const storedActive = (userId: string, { identifier }: IntegrationCourse) =>
  prisma.participation.findFirst({
    where: { userId, isActive: true, courseOffering: identifier },
  });

const synchronize = (
  userId: string,
  course: IntegrationCourse,
  history: AcademicHistory,
  port = recordingChangePort().port,
) => synchronizeCourseOffering(userWith(userId, history), course.identifier, port);

test('a complete history materializes the reported offering and returns its active Participation', async ({
  course,
}) => {
  const identifier = earlier(course);
  const result = await synchronizeCourseOffering(
    userWith(
      course.studentId,
      complete({ ...identifier, institutionalPosition: 'TEACHING_ASSISTANT' }),
    ),
    identifier,
    recordingChangePort().port,
  );
  const stored = await prisma.participation.findFirstOrThrow({
    where: { userId: course.studentId, courseOffering: identifier },
  });
  expect(stored).toMatchObject({
    role: 'TEACHER',
    institutionalPosition: 'TEACHING_ASSISTANT',
    isActive: true,
  });
  expect(result).toEqual({
    status: 'complete',
    position: 'TEACHING_ASSISTANT',
    participation: stored,
  });
});

test('a complete history reactivates the reported offering', async ({ course }) => {
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  const result = await synchronize(course.studentId, course, complete(course.identifier));
  expect(result.participation).toEqual(await storedActive(course.studentId, course));
  expect(result.participation).toMatchObject({ id: course.participationId, isActive: true });
});

test('a complete history that omits the offering deactivates only that offering', async ({
  course,
}) => {
  await synchronizeCourseOffering(
    userWith(course.studentId, complete(earlier(course))),
    earlier(course),
    recordingChangePort().port,
  );
  const result = await synchronize(course.studentId, course, complete(earlier(course)));
  expect(result).toEqual({ status: 'complete', position: null, participation: null });
  expect(await storedActive(course.studentId, course)).toBeNull();
  expect(
    await prisma.participation.count({
      where: { userId: course.studentId, isActive: true, courseOffering: earlier(course) },
    }),
  ).toBe(1);
});

test.for([
  ['partial', { status: 'partial', courses: [reported({ courseCode: 'OTHER', year: 2000 })] }],
  ['unavailable', { status: 'unavailable' }],
] as const)(
  'a %s history preserves the stored active Participation',
  async ([status, history], { course }) => {
    const result = await synchronize(course.studentId, course, history);
    const stored = await storedActive(course.studentId, course);
    expect(stored).toMatchObject({ id: course.participationId, role: 'STUDENT' });
    expect(result).toEqual({ status, participation: stored });
  },
);

test('a complete history without a recognized position neither materializes nor deactivates', async ({
  course,
}) => {
  const history = complete(
    { ...course.identifier, institutionalPosition: null },
    { ...earlier(course), institutionalPosition: null },
  );
  const result = await synchronize(course.studentId, course, history);
  const stored = await storedActive(course.studentId, course);
  expect(stored).toMatchObject({ id: course.participationId, role: 'STUDENT' });
  expect(result).toEqual({ status: 'complete', position: null, participation: stored });
  await synchronizeCourseOffering(
    userWith(course.studentId, history),
    earlier(course),
    recordingChangePort().port,
  );
  expect(
    await prisma.participation.count({
      where: { userId: course.studentId, courseOffering: earlier(course) },
    }),
  ).toBe(0);
});

test('promotion from STUDENT to TEACHER reports the role change and clears simulated Completions', async ({
  course,
}) => {
  await prisma.simulatedCompletion.create({
    data: {
      participationId: course.participationId,
      courseOfferingId: (await storedActive(course.studentId, course))!.courseOfferingId,
      roadmapId: course.roadmapId,
      roadmapNodeId: course.change.nodeId,
    },
  });
  const recording = recordingChangePort();
  const result = await synchronize(
    course.studentId,
    course,
    complete({ ...course.identifier, institutionalPosition: 'AUXILIARY_PROFESSOR' }),
    recording.port,
  );
  expect(result.participation).toMatchObject({ role: 'TEACHER', isActive: true });
  expect(recording.facts()).toEqual([
    {
      kind: 'participation-role',
      recipientId: course.studentId,
      previous: 'STUDENT',
      current: 'TEACHER',
    },
  ]);
  expect(
    await prisma.simulatedCompletion.count({ where: { participationId: course.participationId } }),
  ).toBe(0);
});

const createRoadmap = (userId: string, course: IntegrationCourse, history: AcademicHistory) =>
  requireRoadmapCreationAccess(
    userWith(userId, history),
    course.identifier,
    recordingChangePort().port,
  ).then(
    () => 'allowed',
    () => 'rejected',
  );

test('Roadmap creation follows the position a complete history reports', async ({ course }) => {
  const reporting = (institutionalPosition: MufasaEnrolledCourse['institutionalPosition']) =>
    complete({ ...course.identifier, institutionalPosition });
  expect(await createRoadmap(course.teacherId, course, reporting('COURSE_PROFESSOR'))).toBe(
    'allowed',
  );
  expect(await createRoadmap(course.colleagueId, course, reporting('COORDINATING_PROFESSOR'))).toBe(
    'rejected',
  );
  expect(await createRoadmap(course.studentId, course, reporting(null))).toBe('rejected');
});

test('Roadmap creation falls back to the stored active Participation without a complete history', async ({
  course,
}) => {
  await prisma.participation.updateMany({
    where: { userId: course.teacherId },
    data: { institutionalPosition: 'COURSE_PROFESSOR' },
  });
  for (const history of [{ status: 'partial', courses: [] }, { status: 'unavailable' }] as const)
    expect(await createRoadmap(course.teacherId, course, history)).toBe('allowed');
  expect(await createRoadmap(course.colleagueId, course, { status: 'unavailable' })).toBe(
    'rejected',
  );
  expect(await createRoadmap(course.teacherId, course, complete(earlier(course)))).toBe('rejected');
});
