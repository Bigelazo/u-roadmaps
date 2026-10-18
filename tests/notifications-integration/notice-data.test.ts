import { expect } from 'vitest';
import { test } from './fixtures';
import { addNode, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

// #272: visibility, grouping and recognition read the Notice target, so the notice API's
// `data` no longer carries the legacy read-side fields.
test('the notice API returns each Notice target without the legacy read-side fields', async ({
  course,
}) => {
  const prerequisite = await addNode(course, 'Pilas');
  const dependent = await addNode(course, 'Colas');
  await enterRoadmap(course.studentId, course.roadmapId);
  const edits = teacherEdits(course);
  await edits.rename(course.change.nodeId, 'Recursión');
  await edits.update(course.change.nodeId, { description: 'Nueva descripción' });
  await edits.addResource(course.change.nodeId, 'Guía 3');
  await edits.connect(prerequisite.id, dependent.id);
  await edits.renameType(course.nodeTypeId, 'Unidad');
  await edits.block(prerequisite.id);

  const notices = await pendingNotices(course.studentId, course.roadmapId);
  expect(notices.map(({ data }) => (data as { noticeTarget: string }).noticeTarget).sort()).toEqual(
    [
      'dependency',
      'node-access',
      'node-access',
      'node-description',
      'node-title',
      'node-type-name',
      'resource',
    ],
  );
  for (const { data } of notices)
    for (const key of ['changeKind', 'changedFields', 'targetKind'])
      expect(data).not.toHaveProperty(key);
});
