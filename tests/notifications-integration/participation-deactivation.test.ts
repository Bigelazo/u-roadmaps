import { expect, vi } from 'vitest';
import { student, test, type IntegrationCourse } from './fixtures';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { getAcademicOverviewApi } from '@/app/_adapters/academic-overview';
import {
  completeNode,
  readCourseParticipants,
  readRoadmapForParticipant,
  synchronizeParticipation,
} from '@/features/roadmap/server';
import type {
  MufasaCourseMember,
  MufasaEnrolledCourse,
  MufasaEnrolledCoursesResult,
} from '@/integrations/ucampus/server';
import { pendingNotices, teacherEdits } from './roadmap';

// U-Campus answers per RUT and per Ramo; anything unregistered is unreachable.
const { reports, rosters } = vi.hoisted(() => ({
  reports: new Map<string, MufasaEnrolledCoursesResult>(),
  rosters: new Map<number, MufasaCourseMember[]>(),
}));
vi.mock('@/integrations/ucampus/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/integrations/ucampus/server')>()),
  getMufasaAcademicCourses: async (rut: string | null) =>
    (rut && reports.get(rut)) ?? { source: 'LOCAL', courses: [] },
  getMufasaCourseMembers: async (ramoId: number) => {
    const members = rosters.get(ramoId);
    return members ? { source: 'MUFASA', members } : { source: 'LOCAL', members: [] };
  },
  getMufasaPersonNames: async () => new Map(),
}));

const rutOf = (userId: string) => userId.slice(0, 20);

type Reported = Partial<Omit<MufasaEnrolledCourse, 'semester'>> & IntegrationCourse['identifier'];

/** A U-Campus history listing exactly these Course offerings, as a student by default. */
function reportHistory(userId: string, offerings: Reported[], { isComplete = true } = {}) {
  reports.set(rutOf(userId), {
    source: 'MUFASA',
    isComplete,
    courses: offerings.map((offering) => ({
      name: 'Curso de prueba',
      section: '1',
      ramoId: null,
      isTeaching: false,
      institutionalPosition: 'STUDENT',
      ...offering,
      semester: offering.semester as 1 | 2,
    })),
  });
}

const visitOverview = (userId: string) =>
  getAcademicOverviewApi({ id: userId, rut: rutOf(userId) });

const offeringCodes = async (userId: string) =>
  (await visitOverview(userId)).offerings.map(({ courseCode }) => courseCode);

const canRead = (userId: string, course: IntegrationCourse) =>
  readRoadmapForParticipant({ userId, identifier: course.identifier }).then(
    () => true,
    () => false,
  );

const complete = (course: IntegrationCourse) =>
  completeNode({ ...student(course), nodeId: course.change.nodeId }, scheduledRoadmapChangePort);

test('a complete history that omits an offering deactivates its Participation', async ({
  course,
}) => {
  await complete(course);
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);

  reportHistory(course.studentId, []);
  expect(await offeringCodes(course.studentId)).toEqual([]);

  expect(await canRead(course.studentId, course)).toBe(false);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  // During a later outage the overview falls back to active Participations only.
  reports.delete(rutOf(course.studentId));
  expect(await offeringCodes(course.studentId)).toEqual([]);
});

test('teaching staff still see the Completions of a deactivated student', async ({ course }) => {
  await complete(course);
  reportHistory(course.studentId, []);
  await visitOverview(course.studentId);

  const ramoId = 4242;
  reportHistory(course.teacherId, [
    { ...course.identifier, ramoId, isTeaching: true, institutionalPosition: 'COURSE_PROFESSOR' },
  ]);
  rosters.set(ramoId, [
    { rut: rutOf(course.studentId), section: '1', institutionalPosition: 'STUDENT' },
  ]);
  const participants = await readCourseParticipants(
    { id: course.teacherId, rut: rutOf(course.teacherId) },
    course.identifier,
  );
  expect(participants.students).toMatchObject([{ hasEntered: true, completedNodes: 1 }]);
  rosters.delete(ramoId);
});

test('a later complete history that reports the offering again reactivates it', async ({
  course,
}) => {
  await complete(course);
  reportHistory(course.studentId, []);
  await visitOverview(course.studentId);
  expect(await canRead(course.studentId, course)).toBe(false);

  reportHistory(course.studentId, [course.identifier]);
  expect(await offeringCodes(course.studentId)).toEqual([course.identifier.courseCode]);
  const roadmap = await readRoadmapForParticipant(student(course));
  expect(roadmap.nodes).toMatchObject([{ id: course.change.nodeId, isCompleted: true }]);
});

test('an incomplete or failed history deactivates nothing', async ({ course }) => {
  reportHistory(course.studentId, [], { isComplete: false });
  expect(await offeringCodes(course.studentId)).toEqual([course.identifier.courseCode]);
  reports.delete(rutOf(course.studentId));
  expect(await offeringCodes(course.studentId)).toEqual([course.identifier.courseCode]);
  expect(await canRead(course.studentId, course)).toBe(true);
});

test('teaching staff lose an omitted offering, but not one reported without a usable position', async ({
  course,
}) => {
  reportHistory(course.teacherId, []);
  await visitOverview(course.teacherId);
  expect(await canRead(course.teacherId, course)).toBe(false);

  reportHistory(course.colleagueId, [
    { ...course.identifier, isTeaching: true, institutionalPosition: null },
  ]);
  await visitOverview(course.colleagueId);
  expect(await canRead(course.colleagueId, course)).toBe(true);
});

test('entering one offering deactivates it only when a complete report omits it', async ({
  course,
}) => {
  const enter = (userId: string) =>
    synchronizeParticipation(
      { id: userId, rut: rutOf(userId) },
      course.identifier,
      scheduledRoadmapChangePort,
    );
  reportHistory(course.classmateId, [], { isComplete: false });
  await enter(course.classmateId);
  expect(await canRead(course.classmateId, course)).toBe(true);

  reportHistory(course.studentId, []);
  await enter(course.studentId);
  expect(await canRead(course.studentId, course)).toBe(false);
});
