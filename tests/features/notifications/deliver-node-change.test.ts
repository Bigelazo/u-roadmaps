import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    roadmapNode: { findUnique: vi.fn() },
    roadmapNotice: { createMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    noticeDeliveryEffect: { createMany: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ isActive: true, noticeResetAt: null }]),
    nodeLifecycleKnowledge: { findUnique: vi.fn() },
    noticeKnownValue: { findUnique: vi.fn() },
    $transaction: vi.fn(),
    courseOffering: { findUnique: vi.fn() },
    participation: { findMany: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('./after-tasks')).scheduleAfter,
}));
import { afterTasks, finishResponse } from './after-tasks';
import { deliverNodeChange } from '@/features/notifications/server';

beforeEach(() => {
  vi.useFakeTimers();
  prisma.participation.findFirst.mockResolvedValue({ id: 'participation-id' });
  prisma.roadmapNotice.createMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation((operation) => operation(prisma));
  prisma.noticeDeliveryEffect.createMany.mockResolvedValue({ count: 1 });
  prisma.roadmapNode.findUnique.mockResolvedValue(null);
  prisma.courseOffering.findUnique.mockResolvedValue({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    course: { name: 'Diseño de software' },
  });
  prisma.participation.findMany
    .mockResolvedValueOnce([{ user: { id: 'student-id', name: 'Estudiante A' } }])
    .mockImplementation(async (query: { where: { userId: { in: string[]; not?: string } } }) =>
      query.where.userId.in
        .filter((userId) => userId !== query.where.userId.not)
        .map((userId) => ({ userId })),
    );
  prisma.user.findUnique.mockResolvedValue({ name: 'Docente autora' });
});

afterEach(() => {
  afterTasks.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('own Node notices retain a long valid author and previous Node type through the production message builder', async () => {
  const actorName = 'A'.repeat(200);
  const nodeTypeName = 'Evaluación '.repeat(10);
  prisma.participation.findMany
    .mockReset()
    .mockResolvedValue([
      { userId: 'student-id', user: { id: 'student-id', name: 'Estudiante A' } },
    ]);
  prisma.user.findUnique.mockResolvedValue({ name: actorName });
  const input = {
    userId: 'author-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'deleted-node-id',
    roadmapId: 'roadmap-id',
    nodeTitle: 'Evaluación final',
    changeKind: 'node-deleted' as const,
    changedFields: [],
    nodeTypeName,
    targetKind: 'roadmap' as const,
    recipientIds: ['student-id'],
  };
  await deliverNodeChange({ ...input, eventId: 'first' });
  await finishResponse();
  await deliverNodeChange({ ...input, eventId: 'repeat' });
  await finishResponse();
  // Repeats are stored immediately; no grouping window or summary (ADR-0014 redesign pending).
  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledTimes(2);
  expect(prisma.roadmapNotice.createMany).toHaveBeenLastCalledWith({
    skipDuplicates: true,
    data: [
      expect.objectContaining({
        body: `Nodo eliminado: ${actorName} informó este cambio en el Roadmap de CC3002. Tipo anterior: ${nodeTypeName}.`,
        data: expect.objectContaining({ eventId: 'repeat', actorName, nodeTypeName }),
      }),
    ],
  });
});

test('retains deletion context in the own Inbox', async () => {
  await deliverNodeChange({
    userId: 'author-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'deleted-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-deleted',
    changedFields: [],
    nodeTitle: 'Evaluación final',
    nodeTypeName: 'Evaluación',
    targetKind: 'roadmap',
    recipientIds: ['student-id'],
  });
  await finishResponse();

  expect(prisma.courseOffering.findUnique).toHaveBeenCalled();
  expect(prisma.participation.findMany).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        userId: { in: ['student-id'], not: 'author-id' },
      }),
    }),
  );
  expect(prisma.participation.findMany).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        userId: { in: ['student-id'], not: 'author-id' },
      }),
      select: { userId: true },
    }),
  );
  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledWith({
    skipDuplicates: true,
    data: [
      expect.objectContaining({
        recipientId: 'student-id',
        roadmapId: 'roadmap-id',
        subject: 'Evaluación final',
        body: 'Nodo eliminado: Docente autora informó este cambio en el Roadmap de CC3002. Tipo anterior: Evaluación.',
        occurredAt: expect.any(Date),
        data: expect.objectContaining({
          targetKind: 'roadmap',
          nodeId: 'deleted-node-id',
          nodeTitle: 'Evaluación final',
          changeKind: 'node-deleted',
        }),
      }),
    ],
  });
});

test('accessible Node notices persist without external notification configuration', async () => {
  prisma.roadmapNode.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ isVisible: true });
  await deliverNodeChange({
    userId: 'author-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'visible-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-available',
    changedFields: [],
    nodeTitle: 'Evaluación final',
    recipientIds: ['student-id'],
  });
  await finishResponse();
  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledWith({
    skipDuplicates: true,
    data: [
      expect.objectContaining({
        recipientId: 'student-id',
        roadmapId: 'roadmap-id',
        subject: 'Evaluación final',
        occurredAt: expect.any(Date),
        data: expect.objectContaining({
          nodeId: 'visible-node-id',
          actorName: 'Docente autora',
          changeKind: 'node-available',
          targetKind: 'node',
        }),
      }),
    ],
  });
});
