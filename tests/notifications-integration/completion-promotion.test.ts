import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { prisma } from '@/shared/server/db';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { completeNode } from '@/features/roadmap/server';
import { materializeParticipation } from '@/features/roadmap/application/academic-participation';
import { addNode, confirmed, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];

const accessBodies = (notices: Notice[]) =>
  notices
    .filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-access')
    .map(({ body }) => body)
    .sort();

const complete = (course: IntegrationCourse, nodeId: string) =>
  confirmed(
    completeNode(
      { userId: course.studentId, identifier: course.identifier, nodeId },
      scheduledRoadmapChangePort,
    ),
  );

const promote = (course: IntegrationCourse) =>
  materializeParticipation(
    { id: course.studentId, rut: null },
    course.identifier,
    { name: 'Curso de prueba', positions: ['COURSE_PROFESSOR'] },
    scheduledRoadmapChangePort,
  );

test('completing the prerequisite withdraws the student’s own «fue bloqueado» notice only', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  await teacherEdits(course).connect(prerequisite.id, dependent.id);
  for (const userId of [course.studentId, course.classmateId])
    expect(accessBodies(await pendingNotices(userId, course.roadmapId))).toEqual([
      '«Colas» fue bloqueado.',
    ]);
  await complete(course, prerequisite.id);
  expect(accessBodies(await pendingNotices(course.studentId, course.roadmapId))).toEqual([]);
  expect(accessBodies(await pendingNotices(course.classmateId, course.roadmapId))).toEqual([
    '«Colas» fue bloqueado.',
  ]);
});

test('Completion creates no notice and advances the student’s Known access', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.connect(prerequisite.id, dependent.id);
  // Recognized: the student's Known access of Colas is Bloqueado.
  await enterRoadmap(course.studentId, course.roadmapId);
  const before = await pendingNotices(course.studentId, course.roadmapId);
  await complete(course, prerequisite.id);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual(before);
  // Blocking it now is news against the Known value the Completion produced.
  await edits.block(dependent.id);
  expect(accessBodies(await pendingNotices(course.studentId, course.roadmapId))).toEqual([
    '«Colas» fue bloqueado.',
  ]);
});

test('promotion withdraws pending access notices; later ones compare with the staff view', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.connect(prerequisite.id, dependent.id);
  expect(accessBodies(await pendingNotices(course.studentId, course.roadmapId))).toHaveLength(1);
  await promote(course);
  expect(accessBodies(await pendingNotices(course.studentId, course.roadmapId))).toEqual([]);
  // Staff see Colas as Disponible despite the prerequisite: blocking it is news.
  await edits.block(dependent.id);
  expect(accessBodies(await pendingNotices(course.studentId, course.roadmapId))).toEqual([
    '«Colas» fue bloqueado.',
  ]);
});

test('regaining a Participation starts from zero, with no stale Known values', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const nodeId = course.change.nodeId;
  await edits.rename(nodeId, 'Recursión');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  const deactivate = (isActive: boolean) =>
    prisma.participation.update({ where: { id: course.participationId }, data: { isActive } });
  await deactivate(false);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await edits.rename(nodeId, 'Recursión simple');
  await deactivate(true);
  // A stale Known «Recursividad» would turn this into a revert with nothing to tell.
  await edits.rename(nodeId, 'Recursividad');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { body: '«Recursión simple» pasó a llamarse «Recursividad».' },
  ]);
});
