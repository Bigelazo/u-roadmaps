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
