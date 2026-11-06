import { expect } from 'vitest';
import { test } from './fixtures';
import { addNode, deferredNoticePort, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';
import { countOwnNodeChangeTargets } from '@/features/notifications/server';
import { prisma } from '@/shared/server/db';

test('Participation loss resets pending notices and historical marks before later changes', async ({
  course,
}) => {
  const historical = await addNode(course, 'Pilas');
  await teacherEdits(course).rename(historical.id, 'Pilas históricas');
  await enterRoadmap(course.studentId, course.roadmapId);
  await enterRoadmap(course.classmateId, course.roadmapId);
  const params = new URLSearchParams({ roadmapId: course.roadmapId });
  expect(await countOwnNodeChangeTargets(course.studentId, params)).toEqual({
    byNode: { [historical.id]: 1 },
  });
  const deferred = deferredNoticePort();
  const edits = teacherEdits(course, deferred.port);
  await edits.rename(course.change.nodeId, 'Recursión');
  await deferred.deliver(deferred.deliveries[0]);
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
  expect(await countOwnNodeChangeTargets(course.studentId, params)).toEqual({ byNode: {} });
  expect(await pendingNotices(course.classmateId, course.roadmapId)).toMatchObject([
    { body: '«Recursividad» pasó a llamarse «Recursión avanzada».' },
  ]);
  await teacherEdits(course).rename(course.change.nodeId, 'Recursión renovada');
  expect(await pendingNotices(course.studentId, course.roadmapId)).toHaveLength(1);
  expect(await countOwnNodeChangeTargets(course.studentId, params)).toEqual({
    byNode: { [course.change.nodeId]: 1 },
  });
});
