import { expect } from 'vitest';
import { test } from './fixtures';
import { addNode, enterRoadmap, pendingNotices, teacherEdits, announceRoadmap } from './roadmap';
import {
  countOwnNodeChangeTargets,
  countOwnNotices,
  listOwnNotices,
} from '@/features/notifications/server';

const titleTargets = (notices: { data: unknown }[]) =>
  notices.filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-title');

test('renames before recognition leave one notice from the Known value to the current title', async ({
  course,
}) => {
  const node = await addNode(course, 'Recursión');
  const edits = teacherEdits(course);
  await edits.rename(node.id, 'Recursividad');
  const [first] = await pendingNotices(course.studentId, course.roadmapId);
  await edits.rename(node.id, 'Recursividad avanzada');
  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    id: first.id,
    subject: 'Recursividad avanzada',
    body: '«Recursión» pasó a llamarse «Recursividad avanzada».',
    data: {
      noticeTarget: 'node-title',
      noticeClass: 'roadmap-node-changed',
      nodeId: node.id,
      courseCode: course.identifier.courseCode,
      knownTitle: 'Recursión',
      currentTitle: 'Recursividad avanzada',
    },
  });
  expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
});

test('a return to the Known value withdraws the pending title notice', async ({ course }) => {
  const node = await addNode(course, 'Pilas');
  const edits = teacherEdits(course);
  await edits.rename(node.id, 'Pila');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  await edits.rename(node.id, 'Pilas');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('a rename after recognition is compared with the recognized title', async ({ course }) => {
  const node = await addNode(course, 'Pilas');
  const edits = teacherEdits(course);
  await edits.rename(node.id, 'Pila');
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await edits.rename(node.id, 'Colas');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { body: '«Pila» pasó a llamarse «Colas».' },
  ]);
  await edits.rename(node.id, 'Pila');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('recipients who see the Node blocked are told; nobody is told about a hidden Node', async ({
  course,
}) => {
  const blocked = await addNode(course, 'Grafos', { isTeacherBlocked: true });
  const hidden = await addNode(course, 'Heaps', { isVisible: false });
  const edits = teacherEdits(course);
  await edits.rename(blocked.id, 'Grafos dirigidos');
  await edits.rename(hidden.id, 'Montículos');
  for (const recipient of [course.studentId, course.classmateId])
    expect(await pendingNotices(recipient, course.roadmapId)).toMatchObject([
      { body: '«Grafos» pasó a llamarse «Grafos dirigidos».', data: { nodeId: blocked.id } },
    ]);
  // Revealing the renamed Node is not a title change for anyone.
  await edits.update(hidden.id, { isVisible: true, title: 'Montículos binarios' });
  expect(titleTargets(await pendingNotices(course.studentId, course.roadmapId))).toHaveLength(1);
});

test('a pending Node creation absorbs title changes and deletion absorbs a pending title notice', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const created = await edits.create('Árboles');
  await edits.rename(created.id, 'Árboles binarios');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { noticeTarget: 'node-creation', nodeId: created.id, nodeTitle: 'Árboles binarios' } },
  ]);
  const known = await addNode(course, 'Colas');
  await edits.rename(known.id, 'Colas de prioridad');
  await edits.remove(known.id);
  const remaining = await pendingNotices(course.studentId, course.roadmapId);
  expect(
    remaining.filter(({ data }) => (data as { nodeId: string }).nodeId === known.id),
  ).toMatchObject([{ data: { changeKind: 'node-deleted' } }]);
});

test('a pending Roadmap availability notice absorbs title changes', async ({ course }) => {
  await announceRoadmap(course);
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { changeKind: 'roadmap-available' } },
  ]);
});

test('the Inbox and the Change summary describe a title notice in the same words', async ({
  course,
}) => {
  await enterRoadmap(course.studentId, course.roadmapId);
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión');
  const [notice] = await pendingNotices(course.studentId, course.roadmapId);
  expect(notice.body).toBe('«Recursividad» pasó a llamarse «Recursión».');
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary).toEqual({
    courseCode: course.identifier.courseCode,
    groups: [{ title: 'Recursión', items: [notice.body] }],
  });
});

test('counts, the Node change mark and the Grouped roadmap notice count title targets', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const nodeId = course.change.nodeId;
  const params = new URLSearchParams({ roadmapId: course.roadmapId });
  await edits.rename(nodeId, 'Recursión');
  await edits.rename(nodeId, 'Recursión avanzada');
  expect(await countOwnNotices(course.studentId, params)).toEqual({ count: 1 });
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.rename(nodeId, 'Recursión');
  // Recognized and changed again, the same target marks its Node once.
  expect(await countOwnNodeChangeTargets(course.studentId, params)).toEqual({
    byNode: { [nodeId]: 1 },
  });
  for (const title of ['Pilas', 'Colas']) {
    const node = await addNode(course, title);
    await edits.rename(node.id, `${title} dobles`);
  }
  expect(await countOwnNotices(course.studentId, params)).toEqual({ count: 3 });
  const grouped = await listOwnNotices(
    course.studentId,
    new URLSearchParams({ roadmapId: course.roadmapId, groupBy: 'roadmapId' }),
  );
  expect(grouped.notifications).toMatchObject([
    { data: { changeKind: 'roadmap-grouped', targetCount: 3 } },
  ]);
});
