import { randomUUID } from 'node:crypto';
import { expect, onTestFinished } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { prisma } from '@/shared/server/db';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { releaseScheduledTeacherUnlocks } from '@/features/roadmap/server';
import {
  addNode,
  confirmed,
  deferredNoticePort,
  enterRoadmap,
  pendingNotices,
  teacherEdits,
} from './roadmap';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];

const accessNotices = (notices: Notice[]) =>
  notices.filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-access');

const bodies = async (userId: string, roadmapId: string) =>
  accessNotices(await pendingNotices(userId, roadmapId))
    .map(({ body }) => body)
    .sort();

/** A second member of the teaching staff, who did not make the change. */
async function addTeacher(course: IntegrationCourse) {
  const id = randomUUID();
  onTestFinished(async () => {
    await prisma.user.deleteMany({ where: { id } });
  });
  await prisma.user.create({
    data: {
      id,
      name: 'Ayudante',
      institutionalEmail: `${id}@notifications.u-roadmaps.test`,
      rut: id.slice(0, 20),
    },
  });
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
  });
  await prisma.participation.create({
    data: { userId: id, courseOfferingId: offering.id, role: 'TEACHER' },
  });
  return id;
}

test('hide, show and block before recognition leave one notice; unblocking withdraws it', async ({
  course,
}) => {
  const node = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.update(node.id, { isVisible: false });
  const [hidden] = accessNotices(await pendingNotices(course.studentId, course.roadmapId));
  expect(hidden).toMatchObject({ body: '«Colas» fue ocultado del Roadmap.' });
  await edits.update(node.id, { isVisible: true });
  expect(accessNotices(await pendingNotices(course.studentId, course.roadmapId))).toEqual([]);
  await edits.update(node.id, { isVisible: false });
  await edits.update(node.id, { isVisible: true });
  await edits.block(node.id);
  const notices = accessNotices(await pendingNotices(course.studentId, course.roadmapId));
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    subject: 'Colas',
    body: '«Colas» fue bloqueado.',
    data: {
      noticeTarget: 'node-access',
      noticeClass: 'roadmap-node-changed',
      changeKind: 'node-blocked',
      targetKind: 'roadmap',
      nodeId: node.id,
      nodeTitle: 'Colas',
      knownValue: 'Disponible',
      currentValue: 'Bloqueado',
    },
  });
  await edits.unblock(node.id);
  expect(accessNotices(await pendingNotices(course.studentId, course.roadmapId))).toEqual([]);
  expect(accessNotices(await pendingNotices(course.teacherId, course.roadmapId))).toEqual([]);
});

test('a Node shown again while blocked is described from the Known value', async ({ course }) => {
  const prerequisite = await addNode(course, 'Tipos');
  const node = await addNode(course, 'Variables', { isVisible: false });
  const edits = teacherEdits(course);
  await edits.update(node.id, { isVisible: true });
  await edits.connect(prerequisite.id, node.id);
  expect(await bodies(course.classmateId, course.roadmapId)).toEqual([
    '«Variables» volvió a mostrarse en el Roadmap, pero está bloqueado.',
  ]);
});

test('blocking a Node notifies each recipient once per Node whose state changed for them', async ({
  course,
}) => {
  const staff = await addTeacher(course);
  const first = await addNode(course, 'Listas');
  const second = await addNode(course, 'Pilas');
  const third = await addNode(course, 'Colas');
  await prisma.dependency.createMany({
    data: [
      { sourceNodeId: first.id, targetNodeId: second.id },
      { sourceNodeId: second.id, targetNodeId: third.id },
    ],
  });
  await prisma.completion.createMany({
    data: [first, second].map(({ id }) => ({ userId: course.studentId, roadmapNodeId: id })),
  });
  await teacherEdits(course).block(first.id);
  expect(await bodies(course.studentId, course.roadmapId)).toEqual([
    '«Colas» fue bloqueado.',
    '«Listas» fue bloqueado.',
    '«Pilas» fue bloqueado.',
  ]);
  expect(await bodies(course.classmateId, course.roadmapId)).toEqual(['«Listas» fue bloqueado.']);
  // The block covers the branch for teaching staff, with the same wording as students.
  expect(await bodies(staff, course.roadmapId)).toEqual([
    '«Colas» fue bloqueado.',
    '«Listas» fue bloqueado.',
    '«Pilas» fue bloqueado.',
  ]);
  expect(await bodies(course.teacherId, course.roadmapId)).toEqual([]);
});

test('adding and removing a Dependency changes access only for those it affects', async ({
  course,
}) => {
  const first = await addNode(course, 'Listas');
  const second = await addNode(course, 'Pilas');
  await prisma.completion.create({ data: { userId: course.studentId, roadmapNodeId: first.id } });
  const edits = teacherEdits(course);
  const dependency = await edits.connect(first.id, second.id);
  expect(await bodies(course.studentId, course.roadmapId)).toEqual([]);
  expect(await bodies(course.classmateId, course.roadmapId)).toEqual(['«Pilas» fue bloqueado.']);
  await edits.disconnect(dependency);
  expect(await bodies(course.classmateId, course.roadmapId)).toEqual([]);
});

test('a deferred delivery reconciles against the access recorded at edit time', async ({
  course,
}) => {
  const node = await addNode(course, 'Colas');
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.block(node.id);
  // The Node is unblocked behind the module's back before delivery runs.
  await prisma.roadmapNode.update({ where: { id: node.id }, data: { isTeacherBlocked: false } });
  await deferred.deliver(deferred.deliveries[0]);
  expect(await bodies(course.studentId, course.roadmapId)).toEqual(['«Colas» fue bloqueado.']);
});

test('concurrent and retried deliveries leave one access notice per recipient', async ({
  course,
}) => {
  const node = await addNode(course, 'Colas');
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.update(node.id, { isVisible: false });
  await edits.update(node.id, { isVisible: true });
  await edits.block(node.id);
  expect(deferred.deliveries).toHaveLength(3);
  await Promise.all([...deferred.deliveries, ...deferred.deliveries].map(deferred.deliver));
  await deferred.deliver(deferred.deliveries[0]);
  for (const recipient of [course.studentId, course.classmateId])
    expect(await bodies(recipient, course.roadmapId)).toEqual(['«Colas» fue bloqueado.']);
});

test('recognized access is the new Known value', async ({ course }) => {
  const node = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.block(node.id);
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await bodies(course.studentId, course.roadmapId)).toEqual([]);
  await edits.unblock(node.id);
  expect(await bodies(course.studentId, course.roadmapId)).toEqual(['«Colas» fue desbloqueado.']);
});

test('a Scheduled unlock release notifies like a manual unlock, from teaching staff', async ({
  course,
}) => {
  const node = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  await edits.block(node.id);
  await enterRoadmap(course.studentId, course.roadmapId);
  await prisma.roadmapNode.update({
    where: { id: node.id },
    data: { teacherUnlockOn: new Date('2026-01-01T00:00:00.000Z') },
  });
  await confirmed(releaseScheduledTeacherUnlocks(scheduledRoadmapChangePort, '2026-01-02'));
  expect(accessNotices(await pendingNotices(course.studentId, course.roadmapId))).toMatchObject([
    {
      body: '«Colas» fue desbloqueado.',
      data: { changeKind: 'node-available', actorName: 'Equipo docente' },
    },
  ]);
  // The label is projected at read time; the stored attribution has no name.
  const [stored] = await prisma.roadmapNotice.findMany({
    where: { recipientId: course.studentId, roadmapId: course.roadmapId, acknowledgedAt: null },
  });
  expect((stored.data as { actorName?: unknown }).actorName).toBeNull();
});
