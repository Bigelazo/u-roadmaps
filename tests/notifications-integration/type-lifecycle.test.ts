import { expect } from 'vitest';
import { test } from './fixtures';
import {
  addNode,
  addType,
  deferredNoticePort,
  enterRoadmap,
  pendingNotices,
  teacherEdits,
} from './roadmap';

const typeTargets = <N extends { data: unknown }>(notices: N[]) =>
  notices.filter(({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'node-type');

test('type changes compare the known type with the current one and withdraw on return', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas');
  const reading = await addType(course, 'Lectura');
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  await edits.update(node.id, { nodeTypeId: reading.id });
  const [first] = await pendingNotices(course.studentId, course.roadmapId);
  await edits.update(node.id, { nodeTypeId: workshop.id });
  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices).toHaveLength(1);
  expect(notices[0]).toMatchObject({
    id: first.id,
    subject: 'Pilas',
    body: '«Pilas» pasó de tipo «Tema» a tipo «Taller».',
    data: {
      noticeTarget: 'node-type',
      noticeClass: 'roadmap-node-changed',
      nodeId: node.id,
      knownValue: course.nodeTypeId,
      currentValue: workshop.id,
      knownTypeName: 'Tema',
      currentTypeName: 'Taller',
    },
  });
  await edits.update(node.id, { nodeTypeId: course.nodeTypeId });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
});

test('type notices reach recipients who see the Node blocked; nobody hears of a hidden Node', async ({
  course,
}) => {
  const blocked = await addNode(course, 'Grafos', { isTeacherBlocked: true });
  const hidden = await addNode(course, 'Heaps', { isVisible: false });
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  await edits.update(blocked.id, { nodeTypeId: workshop.id });
  await edits.update(hidden.id, { nodeTypeId: workshop.id });
  for (const recipient of [course.studentId, course.classmateId])
    expect(await pendingNotices(recipient, course.roadmapId)).toMatchObject([
      { data: { noticeTarget: 'node-type', nodeId: blocked.id } },
    ]);
  // Revealing a retyped Node is not a type change for anyone.
  await edits.update(hidden.id, { isVisible: true, nodeTypeId: course.nodeTypeId });
  expect(typeTargets(await pendingNotices(course.studentId, course.roadmapId))).toHaveLength(1);
});

test('a pending type notice keeps the type names the recipient knew after Node type renames', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas');
  const reading = await addType(course, 'Lectura');
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  await edits.update(node.id, { nodeTypeId: reading.id });
  await edits.renameType(course.nodeTypeId, 'Tema renombrado');
  await edits.renameType(reading.id, 'Lectura renombrada');
  expect(typeTargets(await pendingNotices(course.studentId, course.roadmapId))).toMatchObject([
    {
      body: '«Pilas» pasó de tipo «Tema» a tipo «Lectura».',
      data: { knownTypeName: 'Tema', currentTypeName: 'Lectura' },
    },
  ]);
  // A later assignment names the new current type; the known one is still the name recipients knew.
  await edits.update(node.id, { nodeTypeId: workshop.id });
  expect(typeTargets(await pendingNotices(course.studentId, course.roadmapId))).toMatchObject([
    { body: '«Pilas» pasó de tipo «Tema» a tipo «Taller».' },
  ]);
});

test('recognition rebases later type changes on the recognized type and its name', async ({
  course,
}) => {
  const node = await addNode(course, 'Pilas');
  const reading = await addType(course, 'Lectura');
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  await edits.update(node.id, { nodeTypeId: reading.id });
  await enterRoadmap(course.studentId, course.roadmapId);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  await edits.update(node.id, { nodeTypeId: workshop.id });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    {
      body: '«Pilas» pasó de tipo «Lectura» a tipo «Taller».',
      data: { knownValue: reading.id, knownTypeName: 'Lectura' },
    },
  ]);
  await edits.update(node.id, { nodeTypeId: reading.id });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('Node creation and deletion absorb type changes', async ({ course }) => {
  const workshop = await addType(course, 'Taller');
  const edits = teacherEdits(course);
  const created = await edits.create('Árboles');
  await edits.update(created.id, { nodeTypeId: workshop.id });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { noticeTarget: 'node-creation', nodeId: created.id } },
  ]);
  const known = await addNode(course, 'Colas');
  await edits.update(known.id, { nodeTypeId: workshop.id });
  await edits.remove(known.id);
  const remaining = await pendingNotices(course.studentId, course.roadmapId);
  expect(
    remaining.filter(({ data }) => (data as { nodeId: string }).nodeId === known.id),
  ).toMatchObject([{ data: { changeKind: 'node-deleted' } }]);
});

test('the Change summary lists a type change under «Ruta y clasificación» with the current Node title', async ({
  course,
}) => {
  const workshop = await addType(course, 'Taller');
  await enterRoadmap(course.studentId, course.roadmapId);
  const edits = teacherEdits(course);
  await edits.update(course.change.nodeId, { nodeTypeId: workshop.id });
  await edits.rename(course.change.nodeId, 'Recursión');
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary).toEqual({
    courseCode: course.identifier.courseCode,
    groups: [
      { title: 'Recursión', items: ['«Recursividad» pasó a llamarse «Recursión».'] },
      {
        title: 'Ruta y clasificación',
        items: ['«Recursión» pasó de tipo «Tema» a tipo «Taller».'],
      },
    ],
  });
});

test('retried and concurrent deliveries of type changes keep one notice', async ({ course }) => {
  const node = await addNode(course, 'Pilas');
  const reading = await addType(course, 'Lectura');
  const workshop = await addType(course, 'Taller');
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.update(node.id, { nodeTypeId: reading.id });
  await edits.update(node.id, { nodeTypeId: workshop.id });
  const [first, second] = deferred.deliveries;
  await Promise.all([deferred.deliver(second), deferred.deliver(first), deferred.deliver(second)]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    {
      body: '«Pilas» pasó de tipo «Tema» a tipo «Taller».',
      data: { knownValue: course.nodeTypeId, currentValue: workshop.id },
    },
  ]);
});
