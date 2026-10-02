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

import { deliverRoadmapClassificationChange } from '@/features/notifications/server';

beforeEach(() => {
  vi.stubEnv('NOVU_SECRET_KEY', 'test-secret');
  vi.stubEnv('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER', 'test-application');
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
  ensureSubscribers.mockResolvedValue(undefined);
  trigger.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('delivers the type rename to active recipients except the author on the matching Roadmap', async () => {
  await deliverRoadmapClassificationChange({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    roadmapId: 'roadmap-id',
    previousTypeName: 'Lectura',
    nextTypeName: 'Lecturas guiadas',
    recipientIds: ['teacher-id', 'student-id'],
  });

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
  expect(ensureSubscribers).toHaveBeenCalledWith(
    expect.objectContaining({
      recipients: [{ userId: 'student-id', name: 'Estudiante A' }],
    }),
  );
  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      workflowId: 'roadmap-classification-changed',
      recipients: ['student-id'],
      payload: expect.objectContaining({
        targetKind: 'roadmap',
        changeKind: 'classification-updated',
        noticeTitle: 'Tipo «Lectura» → «Lecturas guiadas»',
        noticeBody: expect.stringContaining('actualizó la clasificación'),
      }),
    }),
  );
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
    previousTypeName: 'Lectura',
    nextTypeName: 'Lecturas guiadas',
    recipientIds: ['student-id'],
  });

  expect(prisma.participation.findMany).not.toHaveBeenCalled();
  expect(trigger).not.toHaveBeenCalled();
});
