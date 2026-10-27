import 'dotenv/config';
import { expect } from 'vitest';
import { test, type IntegrationCourse } from '../../../notifications-integration/fixtures';
import { recordingChangePort } from '../support/recording-change-port';
import { prisma } from '@/shared/server/db';
import { synchronizeAcademicHistory, synchronizeCourseOffering } from '@/features/roadmap/server';
import { requireRoadmapCreationAccess } from '@/features/roadmap/application/participation';
import {
  localFixtureUCampus,
  type AcademicHistory,
  type MufasaEnrolledCourse,
} from '@/integrations/ucampus/server';

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

const synchronizeHistory = (userId: string, history: AcademicHistory) =>
  synchronizeAcademicHistory(userWith(userId, history), recordingChangePort().port);

const activeOfferings = async (userId: string) =>
  (
    await prisma.participation.findMany({
      where: { userId, isActive: true },
      select: { role: true, courseOffering: { select: { courseCode: true, year: true } } },
    })
  ).map(({ role, courseOffering }) => ({ role, ...courseOffering }));

test('a complete whole history materializes every reported offering, even without a Roadmap', async ({
  course,
}) => {
  const later = { ...course.identifier, year: course.identifier.year + 1 };
  const history = complete(
    course.identifier,
    earlier(course),
    { ...earlier(course), section: '2', institutionalPosition: 'TEACHING_ASSISTANT' },
    later,
  );
  expect(await synchronizeHistory(course.studentId, history)).toEqual(history);
  expect(await activeOfferings(course.studentId)).toEqual(
    expect.arrayContaining([
      { role: 'STUDENT', courseCode: course.identifier.courseCode, year: later.year },
      { role: 'TEACHER', courseCode: course.identifier.courseCode, year: earlier(course).year },
    ]),
  );
  expect(await activeOfferings(course.studentId)).toHaveLength(3);
  expect(await prisma.roadmap.count({ where: { courseOffering: later } })).toBe(0);
});

test('a complete whole history deactivates every omitted active Participation', async ({
  course,
}) => {
  await synchronizeHistory(course.studentId, complete(course.identifier, earlier(course)));
  const history = complete({ ...course.identifier, year: course.identifier.year + 1 });
  expect(await synchronizeHistory(course.studentId, history)).toEqual(history);
  expect(await activeOfferings(course.studentId)).toEqual([
    { role: 'STUDENT', courseCode: course.identifier.courseCode, year: course.identifier.year + 1 },
  ]);
});

test.for([
  { status: 'partial', courses: [reported({ courseCode: 'OTHER', year: 2000 })] },
  { status: 'unavailable' },
] as const)('a $status whole history preserves everything', async (history, { course }) => {
  await synchronizeHistory(course.studentId, complete(course.identifier, earlier(course)));
  const before = await activeOfferings(course.studentId);
  expect(await synchronizeHistory(course.studentId, history)).toEqual(history);
  expect(await activeOfferings(course.studentId)).toEqual(before);
  expect(await prisma.courseOffering.count({ where: { courseCode: 'OTHER' } })).toBe(0);
});
