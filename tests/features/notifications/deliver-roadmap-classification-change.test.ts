import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    courseOffering: { findUnique: vi.fn() },
    participation: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ isActive: true, noticeResetAt: null }]),
    roadmapNode: { findMany: vi.fn() },
    dependency: { findUnique: vi.fn() },
    nodeType: { findFirst: vi.fn() },
    routeNoticeKnowledge: { upsert: vi.fn() },
    roadmapNotice: { create: vi.fn(), findFirst: vi.fn() },
    noticeDeliveryEffect: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('./after-tasks')).scheduleAfter,
}));
import { afterTasks, finishResponse } from './after-tasks';
import { deliverRoadmapClassificationChange } from '@/features/notifications/server';

beforeEach(() => {
  vi.useFakeTimers();
  delete (globalThis as typeof globalThis & { ownNoticeGrouper?: unknown }).ownNoticeGrouper;
  prisma.$transaction.mockImplementation((operation) => operation(prisma));
  prisma.noticeDeliveryEffect.createMany.mockResolvedValue({ count: 1 });
  prisma.roadmapNotice.findFirst.mockResolvedValue(null);
  prisma.routeNoticeKnowledge.upsert.mockResolvedValue({ knownValue: 'Lectura' });
  prisma.roadmapNode.findMany.mockResolvedValue([
    { id: 'source-id', title: 'Leyes de Newton' },
    { id: 'target-id', title: 'Evaluación 1' },
  ]);
  prisma.dependency.findUnique.mockResolvedValue({ id: 'dependency-id' });
  prisma.nodeType.findFirst.mockResolvedValue({ name: 'Lecturas guiadas' });

  prisma.courseOffering.findUnique.mockResolvedValue({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    roadmap: { id: 'roadmap-id' },
  });
  prisma.participation.findMany
    .mockResolvedValueOnce([{ user: { id: 'student-id', name: 'Estudiante A' } }])
    .mockResolvedValueOnce([{ userId: 'student-id' }]);
  prisma.user.findUnique.mockResolvedValue({ name: 'Docente autora' });
});

afterEach(() => {
  afterTasks.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('stores the type rename to active recipients except the author on the matching Roadmap', async () => {
  await deliverRoadmapClassificationChange({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    nodeTypeId: 'type-id',
    previousTypeName: 'Lectura',
    nextTypeName: 'Lecturas guiadas',
    recipientIds: ['teacher-id', 'student-id'],
  });
  await finishResponse();

  expect(prisma.participation.findMany).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: {
        courseOfferingId: 'offering-id',
        isActive: true,
        userId: { in: ['teacher-id', 'student-id'], not: 'teacher-id' },
      },
    }),
  );
  expect(prisma.roadmapNotice.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      recipientId: 'student-id',
      roadmapId: 'roadmap-id',
      subject: 'Tipo «Lectura» → «Lecturas guiadas»',
      body: 'El tipo «Lectura» ahora se llama «Lecturas guiadas».',
      data: expect.objectContaining({
        targetKind: 'roadmap',
        changeKind: 'classification-updated',
        nodeTypeId: 'type-id',
        previousTypeName: 'Lectura',
        nextTypeName: 'Lecturas guiadas',
      }),
    }),
  });
});

test('does not send a descriptor for another Roadmap', async () => {
  prisma.courseOffering.findUnique.mockResolvedValueOnce({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    roadmap: { id: 'different-roadmap-id' },
  });

  await deliverRoadmapClassificationChange({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    nodeTypeId: 'type-id',
    previousTypeName: 'Lectura',
    nextTypeName: 'Lecturas guiadas',
    recipientIds: ['student-id'],
  });
  await finishResponse();

  expect(prisma.participation.findMany).not.toHaveBeenCalled();
});
