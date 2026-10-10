import { expect } from 'vitest';
import { test } from './fixtures';
import { deferredNoticePort, pendingNotices, teacherEdits } from './roadmap';
import { prisma } from '@/shared/server/db';

test('Participation loss withdraws pending notices even after access returns', async ({
  course,
}) => {
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.rename(course.change.nodeId, 'Recursión');
  await deferred.deliver(deferred.deliveries[0]);
  // A delivery committed before the loss and delivered after it must stay withdrawn.
  await edits.rename(course.change.nodeId, 'Recursión avanzada');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: true },
  });
  await deferred.deliver(deferred.deliveries[1]);
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  expect(await pendingNotices(course.classmateId, course.roadmapId)).toMatchObject([
    { body: '«Recursividad» pasó a llamarse «Recursión avanzada».' },
  ]);
});
