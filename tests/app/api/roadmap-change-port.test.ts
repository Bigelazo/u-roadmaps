import { beforeEach, expect, test, vi } from 'vitest';
const { afterTasks, delivery, recordRoadmapNotices } = vi.hoisted(() => {
  const delivery = vi.fn(async (schedule: (task: () => Promise<void>) => unknown) => {
    await schedule(async () => undefined);
  });
  return {
    afterTasks: [] as (() => Promise<void>)[],
    delivery,
    recordRoadmapNotices: vi.fn(async () => delivery),
  };
});
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => afterTasks.push(task) }));
vi.mock('@/features/notifications/server', () => ({ recordRoadmapNotices }));
import { roadmapChangePort, scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import type { RoadmapChanges } from '@/features/roadmap/server';
import type { Prisma } from '@/shared/server/db';
const tx = {} as Prisma.TransactionClient;
const changes: RoadmapChanges = {
  actorId: 'teacher',
  roadmapId: 'roadmap',
  identifier: { courseCode: 'CC1002', year: 2026, semester: 2 },
  facts: [
    {
      kind: 'node-created',
      nodeId: 'node',
      previous: null,
      current: {
        id: 'node',
        title: 'Pilas',
        description: null,
        nodeTypeId: 'type',
        isVisible: true,
      },
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
});

test('changes are recorded inside the mutation and delivered after commit and the response', async () => {
  const commit = await roadmapChangePort.report(tx, changes);
  expect(recordRoadmapNotices).toHaveBeenCalledWith(tx, changes);
  expect(delivery).not.toHaveBeenCalled();
  if (!commit) throw new Error('Expected delivery');
  await commit();
  expect(afterTasks).toHaveLength(1);
  await afterTasks[0]();
  expect(delivery).toHaveBeenCalledOnce();
});

test('the scheduled pass delivers immediately after commit without a request context', async () => {
  const commit = await scheduledRoadmapChangePort.report(tx, changes);
  if (!commit) throw new Error('Expected delivery');
  await commit();
  expect(delivery).toHaveBeenCalledOnce();
  expect(afterTasks).toHaveLength(0);
});

test('a change without facts records nothing', async () => {
  expect(await roadmapChangePort.report(tx, { ...changes, facts: [] })).toBeUndefined();
  expect(recordRoadmapNotices).not.toHaveBeenCalled();
});
