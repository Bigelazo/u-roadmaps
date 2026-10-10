import { expect } from 'vitest';
import { test } from './fixtures';
import { deferredNoticePort, pendingNotices, teacherEdits } from './roadmap';

test('concurrent deliveries and retries leave one pending notice per recipient and Notice target', async ({
  course,
}) => {
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  for (const title of ['Primero', 'Segundo', 'Tercero'])
    await edits.rename(course.change.nodeId, title);
  expect(deferred.deliveries).toHaveLength(3);
  await Promise.all([...deferred.deliveries, ...deferred.deliveries].map(deferred.deliver));
  await deferred.deliver(deferred.deliveries[0]);
  for (const recipient of [course.studentId, course.classmateId])
    expect(await pendingNotices(recipient, course.roadmapId)).toMatchObject([
      { subject: 'Tercero', body: '«Recursividad» pasó a llamarse «Tercero».' },
    ]);
});

test('a retried delivery of the same Roadmap change is deduplicated', async ({ course }) => {
  const deferred = deferredNoticePort();
  await teacherEdits(course, deferred.port).rename(course.change.nodeId, 'Recursión');
  const [delivery] = deferred.deliveries;
  await deferred.deliver(delivery);
  const [notice] = await pendingNotices(course.studentId, course.roadmapId);
  await deferred.deliver(delivery);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([notice]);
});
