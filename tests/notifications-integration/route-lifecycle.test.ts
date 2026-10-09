import { expect } from 'vitest';
import { test } from './fixtures';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { completeNode } from '@/features/roadmap/server';
import { prisma } from '@/shared/server/db';
import {
  addNode,
  confirmed,
  deferredNoticePort,
  enterRoadmap,
  pendingNotices,
  teacherEdits,
  announceRoadmap,
} from './roadmap';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];
const dataOf = (notice: Notice) => notice.data as Record<string, unknown>;
const routeNotices = async (userId: string, roadmapId: string) =>
  (await pendingNotices(userId, roadmapId)).filter(({ data }) =>
    ['dependency', 'node-type-name'].includes(
      String((data as Record<string, unknown>).noticeTarget),
    ),
  );

test('adding a Dependency tells every student that the dependent Node now requires the prerequisite', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  const dependencyId = await edits.connect(prerequisite.id, dependent.id);
  for (const recipient of [course.studentId, course.classmateId])
    expect(await routeNotices(recipient, course.roadmapId)).toMatchObject([
      {
        subject: 'Ruta actualizada',
        body: '«Colas» ahora requiere «Pilas».',
        data: {
          noticeTarget: 'dependency',
          noticeClass: 'roadmap-path-changed',
          targetKind: 'roadmap',
          changeKind: 'dependency-added',
          dependencyId,
          sourceNodeId: prerequisite.id,
          targetNodeId: dependent.id,
          prerequisiteNodeTitle: 'Pilas',
          dependentNodeTitle: 'Colas',
          knownValue: 'false',
          currentValue: 'true',
          courseCode: course.identifier.courseCode,
        },
      },
    ]);
  const [notice] = await routeNotices(course.studentId, course.roadmapId);
  expect(dataOf(notice).nodeId).toBeUndefined();
  expect(await routeNotices(course.teacherId, course.roadmapId)).toEqual([]);
});

test('removing a Dependency names the pair; added then removed, or removed then re-added, withdraws', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  const first = await edits.connect(prerequisite.id, dependent.id);
  expect(await routeNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  await edits.disconnect(first);
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);

  await enterRoadmap(course.studentId, course.roadmapId);
  const second = await edits.connect(prerequisite.id, dependent.id);
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.disconnect(second);
  const [removed] = await routeNotices(course.studentId, course.roadmapId);
  expect(removed).toMatchObject({
    body: '«Colas» ya no requiere «Pilas».',
    data: {
      changeKind: 'dependency-removed',
      dependencyId: second,
      knownValue: 'true',
      currentValue: 'false',
    },
  });
  // The same pair with a new Dependency id is the same target.
  await edits.connect(prerequisite.id, dependent.id);
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('reversing a Dependency gives one notice per pair', async ({ course }) => {
  const trees = await addNode(course, 'Árboles');
  const queues = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  const original = await edits.connect(queues.id, trees.id);
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.disconnect(original);
  await edits.connect(trees.id, queues.id);
  expect(
    (await routeNotices(course.studentId, course.roadmapId)).map(({ body }) => body).sort(),
  ).toEqual(['«Colas» ahora requiere «Árboles».', '«Árboles» ya no requiere «Colas».']);
});

test('a student who completed the prerequisite is still told the route changed', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  await confirmed(
    completeNode(
      { userId: course.studentId, identifier: course.identifier, nodeId: prerequisite.id },
      scheduledRoadmapChangePort,
    ),
  );
  await teacherEdits(course).connect(prerequisite.id, dependent.id);
  expect(await routeNotices(course.studentId, course.roadmapId)).toMatchObject([
    { body: '«Colas» ahora requiere «Pilas».' },
  ]);
});

test('Dependencies removed by hiding or deleting a Node give no route notice', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const source = await addNode(course, 'Pilas');
  const hidden = await addNode(course, 'Colas');
  const deleted = await addNode(course, 'Árboles');
  await edits.connect(source.id, hidden.id);
  await edits.connect(source.id, deleted.id);
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.update(hidden.id, { isVisible: false });
  await edits.remove(deleted.id);
  expect(await prisma.dependency.count({ where: { sourceNodeId: source.id } })).toBe(0);
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('the Change summary places route notices under «Ruta y clasificación» in the Inbox words', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  await enterRoadmap(course.studentId, course.roadmapId);
  await teacherEdits(course).connect(prerequisite.id, dependent.id);
  const [notice] = await routeNotices(course.studentId, course.roadmapId);
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary?.groups).toContainEqual({ title: 'Ruta y clasificación', items: [notice.body] });
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('renaming a Node type several times gives one notice from the known name; renaming back withdraws it', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  await edits.updateType(course.nodeTypeId, { name: 'Lectura' });
  const [first] = await routeNotices(course.studentId, course.roadmapId);
  await edits.updateType(course.nodeTypeId, { name: 'Lectura obligatoria' });
  for (const recipient of [course.studentId, course.classmateId])
    expect(await routeNotices(recipient, course.roadmapId)).toMatchObject([
      {
        subject: 'Tipo «Tema» → «Lectura obligatoria»',
        body: 'El tipo «Tema» ahora se llama «Lectura obligatoria».',
        data: {
          noticeTarget: 'node-type-name',
          noticeClass: 'roadmap-classification-changed',
          targetKind: 'roadmap',
          changeKind: 'classification-updated',
          nodeTypeId: course.nodeTypeId,
          previousTypeName: 'Tema',
          nextTypeName: 'Lectura obligatoria',
        },
      },
    ]);
  expect((await routeNotices(course.studentId, course.roadmapId))[0].id).toBe(first.id);
  expect(dataOf(first).nodeId).toBeUndefined();
  expect(await routeNotices(course.teacherId, course.roadmapId)).toEqual([]);
  await edits.updateType(course.nodeTypeId, { name: 'Tema' });
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('a rename after recognition is compared with the recognized name', async ({ course }) => {
  const edits = teacherEdits(course);
  await edits.updateType(course.nodeTypeId, { name: 'Lectura' });
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.updateType(course.nodeTypeId, { name: 'Taller' });
  expect(await routeNotices(course.studentId, course.roadmapId)).toMatchObject([
    { body: 'El tipo «Lectura» ahora se llama «Taller».' },
  ]);
});

test('icon and color changes, and types without a visible Node, give no notice', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  await edits.updateType(course.nodeTypeId, { icon: 'BookOpen', color: '#1467A8' });
  const unused = await prisma.nodeType.create({
    data: {
      name: 'Taller',
      normalizedName: 'taller',
      icon: 'BookOpen',
      color: '#024AD8',
      roadmapId: course.roadmapId,
    },
  });
  await prisma.roadmapNode.create({
    data: {
      title: 'Oculto',
      roadmapId: course.roadmapId,
      nodeTypeId: unused.id,
      positionX: 0,
      positionY: 0,
      isVisible: false,
    },
  });
  await edits.updateType(unused.id, { name: 'Seminario' });
  expect(await routeNotices(course.studentId, course.roadmapId)).toEqual([]);
});

test('deferred route deliveries in any order and retried leave one notice per target', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.disconnect(await edits.connect(prerequisite.id, dependent.id));
  await edits.connect(prerequisite.id, dependent.id);
  await edits.updateType(course.nodeTypeId, { name: 'Lectura' });
  await edits.updateType(course.nodeTypeId, { name: 'Taller' });
  const reversed = [...deferred.deliveries].reverse();
  await Promise.all([...reversed, ...reversed].map(deferred.deliver));
  for (const recipient of [course.studentId, course.classmateId])
    expect(
      (await routeNotices(recipient, course.roadmapId)).map(({ body }) => body).sort(),
    ).toEqual(['El tipo «Tema» ahora se llama «Taller».', '«Colas» ahora requiere «Pilas».']);
});

test('a pending Roadmap availability absorbs route changes; entry recognizes the route as it was', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  await announceRoadmap(course);
  const edits = teacherEdits(course);
  const dependencyId = await edits.connect(prerequisite.id, dependent.id);
  await edits.updateType(course.nodeTypeId, { name: 'Lectura' });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toMatchObject([
    { data: { changeKind: 'roadmap-available' } },
  ]);
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.disconnect(dependencyId);
  await edits.updateType(course.nodeTypeId, { name: 'Taller' });
  expect(
    (await routeNotices(course.studentId, course.roadmapId)).map(({ body }) => body).sort(),
  ).toEqual(['El tipo «Lectura» ahora se llama «Taller».', '«Colas» ya no requiere «Pilas».']);
});
