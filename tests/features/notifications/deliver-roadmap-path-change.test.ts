import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma, ensureSubscribers, trigger } = vi.hoisted(() => ({
  prisma: {
    courseOffering: { findUnique: vi.fn() },
    participation: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  ensureSubscribers: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('@/features/notifications/infrastructure/novu-transport', () => ({
  novuTransport: { ensureSubscribers, trigger },
}));

import { deliverRoadmapPathChange } from '@/features/notifications/server';

beforeEach(() => {
  process.env.NOVU_NOTIFICATIONS_ENABLED = 'true';
  process.env.NOVU_WORKFLOW_PATH_CHANGE = 'roadmap-path-changed';
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
  ensureSubscribers.mockResolvedValue(undefined);
  trigger.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NOVU_NOTIFICATIONS_ENABLED;
  delete process.env.NOVU_WORKFLOW_PATH_CHANGE;
});

test('delivers only active explicit recipients for the matching Roadmap', async () => {
  await deliverRoadmapPathChange({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    changeKind: 'dependency-added',
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
    recipientIds: ['teacher-id', 'student-id', 'observer-id'],
  });

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
  expect(ensureSubscribers).toHaveBeenCalledWith(
    expect.objectContaining({
      recipients: [
        { userId: 'student-id', name: 'Estudiante A' },
        { userId: 'observer-id', name: 'Observadora B' },
      ],
    }),
  );
  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      workflowId: 'roadmap-path-changed',
      roadmapId: 'roadmap-id',
      recipients: ['student-id', 'observer-id'],
      payload: expect.objectContaining({
        targetKind: 'roadmap',
        changeKind: 'dependency-added',
        noticeBody: expect.stringContaining('«Evaluación 1» ahora requiere «Leyes de Newton»'),
      }),
    }),
  );
});

test('does not deliver against a different current Course offering Roadmap', async () => {
  prisma.courseOffering.findUnique.mockResolvedValueOnce({
    id: 'offering-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    roadmap: { id: 'another-roadmap-id' },
  });

  await deliverRoadmapPathChange({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    changeKind: 'dependency-removed',
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
    recipientIds: ['student-id'],
  });

  expect(prisma.participation.findMany).not.toHaveBeenCalled();
  expect(trigger).not.toHaveBeenCalled();
});
