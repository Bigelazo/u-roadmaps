import { expect } from 'vitest';
import { test } from './fixtures';
import { deliverNodeChange, listOwnNotices } from '@/features/notifications/server';

test('concurrent deliveries and retries leave one pending notice per recipient and Notice target', async ({
  course,
}) => {
  await Promise.all([
    deliverNodeChange(course.change, (deliver) => deliver()),
    deliverNodeChange(course.change, (deliver) => deliver()),
    deliverNodeChange({ ...course.change, eventId: crypto.randomUUID() }, (deliver) => deliver()),
  ]);
  await deliverNodeChange(course.change, (deliver) => deliver());
  const inbox = await listOwnNotices(
    course.studentId,
    new URLSearchParams({ roadmapId: course.roadmapId }),
  );
  expect(inbox.notifications).toHaveLength(1);
  expect(inbox.notifications[0]).toMatchObject({
    subject: 'Recursividad',
    body: '«Recursión» pasó a llamarse «Recursividad».',
  });
});
