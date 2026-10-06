import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    courseOffering: { findUnique: vi.fn() },
    participation: { findMany: vi.fn() },
    roadmapNotice: { createMany: vi.fn() },
    noticeDeliveryEffect: { createMany: vi.fn() },
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('./after-tasks')).scheduleAfter,
}));
import { afterTasks, finishResponse } from './after-tasks';
import { deliverRoadmapPathChange } from '@/features/notifications/server';

beforeEach(() => {
  vi.useFakeTimers();
  delete (globalThis as typeof globalThis & { ownNoticeGrouper?: unknown }).ownNoticeGrouper;
  prisma.$transaction.mockImplementation((operation) => operation(prisma));
  prisma.noticeDeliveryEffect.createMany.mockResolvedValue({ count: 1 });
  prisma.courseOffering.findUnique.mockResolvedValue({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    roadmap: { id: 'roadmap-id' },
  });
  prisma.participation.findMany
    .mockResolvedValueOnce([
      { user: { id: 'student-id', name: 'Estudiante A' } },
      { user: { id: 'observer-id', name: 'Observadora B' } },
    ])
    .mockResolvedValueOnce([{ userId: 'student-id' }, { userId: 'observer-id' }]);
  prisma.user.findUnique.mockResolvedValue({ name: 'Docente autora' });
  prisma.roadmapNotice.createMany.mockResolvedValue({ count: 2 });
});

afterEach(() => {
  afterTasks.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('stores the route notice for active explicit recipients through the own Inbox', async () => {
  await deliverRoadmapPathChange({
    eventId: 'dependency-id:dependency-added',
    dependencyId: 'dependency-id',
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    changeKind: 'dependency-added',
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
    recipientIds: ['teacher-id', 'student-id', 'observer-id'],
  });
  await finishResponse();

  expect(prisma.courseOffering.findUnique).toHaveBeenCalledWith({
    where: { courseCode_year_semester: { courseCode: 'CC3002', year: 2026, semester: 2 } },
    include: { roadmap: { select: { id: true } } },
  });
  expect(prisma.participation.findMany).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: {
        courseOfferingId: 'offering-id',
        isActive: true,
        userId: { in: ['teacher-id', 'student-id', 'observer-id'], not: 'teacher-id' },
      },
    }),
  );
  expect(prisma.participation.findMany).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      where: {
        courseOfferingId: 'offering-id',
        isActive: true,
        userId: { in: ['student-id', 'observer-id'], not: 'teacher-id' },
      },
    }),
  );
  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        eventId: 'dependency-id:dependency-added',
        recipientId: 'student-id',
        roadmapId: 'roadmap-id',
        courseOfferingId: 'offering-id',
        subject: 'Ruta actualizada',
        body: 'Docente autora actualizó la ruta de CC3002: «Evaluación 1» ahora requiere «Leyes de Newton».',
        data: expect.objectContaining({
          targetKind: 'roadmap',
          changeKind: 'dependency-added',
          dependencyId: 'dependency-id',
          dependentNodeTitle: 'Evaluación 1',
          prerequisiteNodeTitle: 'Leyes de Newton',
        }),
      }),
    ],
    skipDuplicates: true,
  });
});

test('does not store a notice against a different current Course offering Roadmap', async () => {
  prisma.courseOffering.findUnique.mockResolvedValueOnce({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    roadmap: { id: 'another-roadmap-id' },
  });

  await deliverRoadmapPathChange({
    eventId: 'dependency-id:dependency-removed',
    dependencyId: 'dependency-id',
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    changeKind: 'dependency-removed',
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
    recipientIds: ['student-id'],
  });
  await finishResponse();

  expect(prisma.participation.findMany).not.toHaveBeenCalled();
  expect(prisma.roadmapNotice.createMany).not.toHaveBeenCalled();
});
