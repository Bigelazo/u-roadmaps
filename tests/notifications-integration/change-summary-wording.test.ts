import { expect } from 'vitest';
import { test } from './fixtures';
import { addNode, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

test('the Change summary uses the Inbox words for title, access, new and deleted Node notices', async ({
  course,
}) => {
  const deleted = await addNode(course, 'Colas');
  await enterRoadmap(course.studentId, course.roadmapId);
  const edits = teacherEdits(course);
  await edits.rename(course.change.nodeId, 'Recursión');
  await edits.block(course.change.nodeId);
  await edits.create('Pilas');
  await edits.remove(deleted.id);
  const inbox = (await pendingNotices(course.studentId, course.roadmapId)).map(({ body }) => body);
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(inbox).toEqual([
    'Nodo eliminado: «Colas».',
    'Nuevo Nodo «Pilas».',
    '«Recursión» fue bloqueado.',
    '«Recursividad» pasó a llamarse «Recursión».',
  ]);
  expect(summary).toEqual({
    courseCode: course.identifier.courseCode,
    groups: [
      { title: 'Colas', items: ['Nodo eliminado.'] },
      { title: 'Pilas', items: ['Nuevo Nodo «Pilas».'] },
      {
        title: 'Recursión',
        items: ['«Recursión» fue bloqueado.', '«Recursividad» pasó a llamarse «Recursión».'],
      },
    ],
  });
});

test('a blocked new Node reads «(bloqueado)» in the Inbox and the Change summary', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Listas');
  await enterRoadmap(course.studentId, course.roadmapId);
  const edits = teacherEdits(course);
  const node = await edits.create('Pilas');
  await edits.connect(prerequisite.id, node.id);
  const inbox = (await pendingNotices(course.studentId, course.roadmapId)).map(({ body }) => body);
  expect(inbox).toContain('Nuevo Nodo «Pilas» (bloqueado).');
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary?.groups).toContainEqual({
    title: 'Pilas',
    items: ['Nuevo Nodo «Pilas» (bloqueado).'],
  });
});

test('Resource summary items leave out the Node, which titles the group', async ({ course }) => {
  const nodeId = course.change.nodeId;
  const edits = teacherEdits(course);
  const kept = await edits.addResource(nodeId, 'Guía 1');
  const removed = await edits.addResource(nodeId, 'Guía 2');
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.editResource(kept.id, { title: 'Guía 1 resuelta' });
  await edits.removeResource(removed.id);
  await edits.addResource(nodeId, 'Guía 3');
  const inbox = (await pendingNotices(course.studentId, course.roadmapId)).map(({ body }) => body);
  expect(inbox).toEqual([
    'Nuevo recurso «Guía 3» en «Recursividad».',
    'Se eliminó el recurso «Guía 2» de «Recursividad».',
    'Se actualizó el recurso «Guía 1» en «Recursividad». «Guía 1» ahora se llama «Guía 1 resuelta».',
  ]);
  const { summary } = await enterRoadmap(course.studentId, course.roadmapId);
  expect(summary?.groups).toEqual([
    {
      title: 'Recursividad',
      items: [
        'Nuevo recurso «Guía 3».',
        'Se eliminó el recurso «Guía 2».',
        'Se actualizó el recurso «Guía 1». «Guía 1» ahora se llama «Guía 1 resuelta».',
      ],
    },
  ]);
});
