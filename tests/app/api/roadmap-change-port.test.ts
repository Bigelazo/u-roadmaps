import { beforeEach, expect, test, vi } from 'vitest';
const {
  afterTasks,
  deliverNodeChange,
  deliverRoadmapAvailability,
  deliverRoadmapPathChange,
  deliverRoadmapClassificationChange,
} = vi.hoisted(() => ({
  afterTasks: [] as (() => Promise<void>)[],
  deliverNodeChange: vi.fn<typeof import('@/features/notifications/server').deliverNodeChange>(
    async () => undefined,
  ),
  deliverRoadmapAvailability: vi.fn(async () => undefined),
  deliverRoadmapPathChange: vi.fn(async () => undefined),
  deliverRoadmapClassificationChange: vi.fn(async () => undefined),
}));
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => afterTasks.push(task) }));
vi.mock('@/features/notifications/server', () => ({
  recordRoadmapNotices: async () => undefined,
  deliverNodeChange,
  deliverRoadmapAvailability,
  deliverRoadmapPathChange,
  deliverRoadmapClassificationChange,
}));
vi.mock('@/shared/server/db', () => ({
  prisma: {
    participation: { findMany: async () => [{ userId: 'student' }] },
    roadmapNode: { count: async () => 1 },
  },
}));
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
      kind: 'node-access',
      nodeId: 'node',
      recipientId: 'student',
      previous: 'Bloqueado',
      current: 'Disponible',
      nodeTitle: 'Pilas',
      nodeTypeName: 'Tema',
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  afterTasks.length = 0;
});

test('HTTP delivery waits for commit and the response, preserving recipient transitions', async () => {
  const commit = await roadmapChangePort.report(tx, changes);
  expect(afterTasks).toHaveLength(0);
  expect(deliverNodeChange).not.toHaveBeenCalled();
  if (!commit) throw new Error('Expected delivery');
  await commit();
  const persist = vi.fn(async () => undefined);
  const schedule = deliverNodeChange.mock.calls[0][1];
  if (!schedule) throw new Error('Expected deferred scheduler');
  await schedule(persist);
  expect(persist).not.toHaveBeenCalled();
  expect(afterTasks).toHaveLength(1);
  await afterTasks[0]();
  expect(persist).toHaveBeenCalledOnce();
  expect(deliverNodeChange).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: 'teacher',
      nodeId: 'node',
      previousAccess: 'Bloqueado',
      changeKind: 'node-available',
      recipientIds: ['student'],
    }),
    expect.any(Function),
  );
});

test('the scheduled pass delivers immediately after commit without a request context', async () => {
  const commit = await scheduledRoadmapChangePort.report(tx, changes);
  if (!commit) throw new Error('Expected delivery');
  await commit();
  expect(deliverNodeChange).toHaveBeenCalledOnce();
  expect(afterTasks).toHaveLength(0);
  const persist = vi.fn(async () => undefined);
  const schedule = deliverNodeChange.mock.calls[0][1];
  if (!schedule) throw new Error('Expected immediate scheduler');
  await schedule(persist);
  expect(persist).toHaveBeenCalledOnce();
});

test('Completion and promotion stay silent in the transitional delivery adapter', async () => {
  const commit = await scheduledRoadmapChangePort.report(tx, {
    ...changes,
    facts: [
      {
        ...changes.facts[0],
        kind: 'node-access',
        nodeId: 'node',
        recipientId: 'teacher',
        previous: 'Bloqueado',
        current: 'Disponible',
        nodeTitle: 'Pilas',
        nodeTypeName: 'Tema',
      },
      {
        kind: 'participation-role',
        recipientId: 'student',
        previous: 'STUDENT',
        current: 'TEACHER',
      },
    ],
  });
  if (commit) await commit();
  expect(deliverNodeChange).not.toHaveBeenCalled();
});

test('one delivery failure does not prevent later facts from reaching their entry point', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  deliverNodeChange.mockRejectedValueOnce(new Error('notice unavailable'));
  const commit = await scheduledRoadmapChangePort.report(tx, {
    ...changes,
    facts: [
      ...changes.facts,
      {
        kind: 'roadmap-created',
        previous: null,
        current: {
          courseOfferingId: 'offering',
          courseName: 'Estructuras de Datos',
          actorName: 'Docente',
          occurredAt: new Date(),
          recipients: [{ userId: 'student', name: 'Estudiante' }],
        },
      },
    ],
  });
  if (commit) await commit();
  expect(deliverRoadmapAvailability).toHaveBeenCalledWith(
    expect.objectContaining({
      roadmapId: 'roadmap',
      recipients: [{ userId: 'student', name: 'Estudiante' }],
    }),
    expect.any(Function),
  );
  vi.restoreAllMocks();
});

test('committed delivery keeps the audience and classification eligibility captured inside the mutation', async () => {
  const state = { participants: [{ userId: 'original-student' }], visibleNodeCount: 1 };
  const transaction = {
    participation: { findMany: async () => [...state.participants] },
    roadmapNode: { count: async () => state.visibleNodeCount },
  } as unknown as Prisma.TransactionClient;
  const commit = await scheduledRoadmapChangePort.report(transaction, {
    ...changes,
    facts: [
      {
        kind: 'node-deleted',
        nodeId: 'deleted',
        previous: {
          id: 'deleted',
          title: 'Pilas',
          description: null,
          nodeTypeId: 'type',
          isVisible: true,
        },
        current: null,
        nodeTypeName: 'Tema',
      },
      {
        kind: 'dependency',
        dependencyId: 'dependency',
        sourceNodeId: 'source',
        targetNodeId: 'target',
        previous: false,
        current: true,
        sourceNode: { title: 'Pilas', isVisible: true },
        targetNode: { title: 'Colas', isVisible: true },
      },
      { kind: 'node-type-name', nodeTypeId: 'type', previous: 'Tema', current: 'Lectura' },
    ],
  });
  state.participants = [{ userId: 'new-student' }];
  state.visibleNodeCount = 0;
  if (!commit) throw new Error('Expected delivery');
  await commit();
  expect(deliverNodeChange).toHaveBeenCalledWith(
    expect.objectContaining({ recipientIds: ['original-student'], changeKind: 'node-deleted' }),
    expect.any(Function),
  );
  expect(deliverRoadmapPathChange).toHaveBeenCalledWith(
    expect.objectContaining({ recipientIds: ['original-student'], changeKind: 'dependency-added' }),
    expect.any(Function),
  );
  expect(deliverRoadmapClassificationChange).toHaveBeenCalledWith(
    expect.objectContaining({
      recipientIds: ['original-student'],
      previousTypeName: 'Tema',
      nextTypeName: 'Lectura',
    }),
    expect.any(Function),
  );
});
