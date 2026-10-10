import { expect } from 'vitest';
import { test } from './fixtures';
import { prisma } from '@/shared/server/db';
import { countOwnNotices } from '@/features/notifications/server';
import { addNode, deferredNoticePort, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

const descriptionTargets = <N extends { data: unknown }>(notices: N[]) =>
  notices.filter(
    ({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-description',
  );

test('description edits before recognition leave one notice; only an exact return withdraws it', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas', { description: 'Original' });
  const edits = teacherEdits(course);
  await edits.update(node.id, { description: 'Primera' });
  const [first] = await pendingNotices(course.studentId, course.roadmapId);
  await edits.update(node.id, { description: 'Segunda' });
  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    id: first.id,
    subject: 'Pilas',
    body: 'Se actualizó la descripción de «Pilas».',
    data: {
      noticeTarget: 'node-description',
      noticeClass: 'roadmap-node-changed',
      nodeId: node.id,
      nodeTitle: 'Pilas',
      knownValue: '"Original"',
      currentValue: '"Segunda"',
    },
  });
  await edits.update(node.id, { description: 'Original ' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  await edits.update(node.id, { description: 'Original' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
});

test('description notices reach only recipients for whom the Node is accessible', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Listas');
  const node = await addNode(course, 'Pilas', { description: 'Original' });
  await prisma.dependency.create({
    data: { sourceNodeId: prerequisite.id, targetNodeId: node.id },
  });
  await prisma.completion.create({
    data: { userId: course.studentId, roadmapNodeId: prerequisite.id },
  });
  await teacherEdits(course).update(node.id, { description: 'Nueva' });
  expect(
    descriptionTargets(await pendingNotices(course.studentId, course.roadmapId)),
  ).toMatchObject([{ data: { nodeId: node.id } }]);
  expect(await pendingNotices(course.classmateId, course.roadmapId)).toEqual([]);
});

test('a pending description hides while the Node is blocked and reappears when unblocked', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas', { description: 'Original' });
  const edits = teacherEdits(course);
  await edits.update(node.id, { description: 'Nueva' });
  const [pending] = descriptionTargets(await pendingNotices(course.studentId, course.roadmapId));
  await edits.block(node.id);
  expect(descriptionTargets(await pendingNotices(course.studentId, course.roadmapId))).toEqual([]);
  // Only the access notice is counted while the description is hidden.
  expect(
    await countOwnNotices(course.studentId, new URLSearchParams({ roadmapId: course.roadmapId })),
  ).toEqual({ count: 1 });
  await edits.unblock(node.id);
  expect(
    descriptionTargets(await pendingNotices(course.studentId, course.roadmapId)),
  ).toMatchObject([{ id: pending.id, data: { knownValue: '"Original"' } }]);
});

test('a description edited while the Node is blocked is not news once it is unblocked', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas', { description: 'Original', isTeacherBlocked: true });
  const edits = teacherEdits(course);
  await edits.update(node.id, { description: 'Nueva' });
  await edits.unblock(node.id);
  for (const recipient of [course.studentId, course.classmateId])
    expect(descriptionTargets(await pendingNotices(recipient, course.roadmapId))).toEqual([]);
});

test('recognition rebases later description edits on the recognized text', async ({ course }) => {
  const node = await addNode(course, 'Pilas', { description: 'Original' });
  const edits = teacherEdits(course);
  await edits.update(node.id, { description: 'Reconocida' });
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await edits.update(node.id, { description: 'Posterior' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { knownValue: '"Reconocida"', currentValue: '"Posterior"' } },
  ]);
  await edits.update(node.id, { description: 'Reconocida' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('Node creation and deletion absorb description changes', async ({ course }) => {
  const edits = teacherEdits(course);
  const created = await edits.create('Árboles');
  await edits.update(created.id, { description: 'Recorridos' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { noticeTarget: 'node-creation', nodeId: created.id } },
  ]);
  const known = await addNode(course, 'Colas', { description: 'Original' });
  await edits.update(known.id, { description: 'Nueva' });
  await edits.remove(known.id);
  const remaining = await pendingNotices(course.studentId, course.roadmapId);
  expect(
    remaining.filter(({ data }) => (data as { nodeId: string }).nodeId === known.id),
  ).toMatchObject([{ data: { changeKind: 'node-deleted' } }]);
});

test('the Change summary lists a description change under its Node', async ({ course }) => {
  await enterRoadmap(course.studentId, course.roadmapId);
  await teacherEdits(course).update(course.change.nodeId, { description: 'Nueva' });
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary).toEqual({
    courseCode: course.identifier.courseCode,
    groups: [{ title: 'Recursividad', items: ['Se actualizó la descripción.'] }],
  });
});

test('retried and concurrent deliveries of description edits keep one notice', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas', { description: 'Original' });
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.update(node.id, { description: 'Primera' });
  await edits.update(node.id, { description: 'Segunda' });
  const [first, second] = deferred.deliveries;
  await Promise.all([deferred.deliver(second), deferred.deliver(first), deferred.deliver(second)]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { knownValue: '"Original"', currentValue: '"Segunda"' } },
  ]);
});
