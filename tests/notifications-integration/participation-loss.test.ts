import { expect } from 'vitest';
import { test } from './fixtures';
import { deliverNodeChange, listOwnNotices } from '@/features/notifications/server';
import { prisma } from '@/shared/server/db';

test('Participation loss withdraws pending notices even after access returns', async ({
  course,
}) => {
  await deliverNodeChange(course.change, (deliver) => deliver());
  const inbox = () =>
    listOwnNotices(course.studentId, new URLSearchParams({ roadmapId: course.roadmapId }));
  expect((await inbox()).notifications).toHaveLength(1);
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: true },
  });
  expect((await inbox()).notifications).toEqual([]);
});
