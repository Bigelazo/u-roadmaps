import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma, ensureSubscribers, trigger } = vi.hoisted(() => ({
  prisma: {
    roadmapNode: { findUnique: vi.fn() },
    roadmapNotice: { createMany: vi.fn() },
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

import { deliverNodeChange } from '@/features/notifications/server';

beforeEach(() => {
  process.env.NOVU_NOTIFICATIONS_ENABLED = 'true';
  process.env.NOVU_WORKFLOW_NODE_CHANGE = 'roadmap-node-changed';
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
  ensureSubscribers.mockResolvedValue(undefined);
  trigger.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NOVU_NOTIFICATIONS_ENABLED;
  delete process.env.NOVU_WORKFLOW_NODE_CHANGE;
});

test('retained deletion context routes to the Roadmap and rechecks active recipients', async () => {
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
  expect(trigger).toHaveBeenCalledWith(
    expect.objectContaining({
      recipients: ['student-id'],
      payload: expect.objectContaining({
        targetKind: 'roadmap',
        nodeId: 'deleted-node-id',
        nodeTitle: 'Evaluación final',
        nodeTypeName: 'Evaluación',
        changeKind: 'node-deleted',
      }),
    }),
  );
});

test('accessible Node notices persist without external notification configuration', async () => {
  vi.stubEnv('NOVU_SECRET_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER', '');
  await deliverNodeChange({
    userId: 'author-id',
    courseCode: 'CC3002',
    year: 2026,
    semester: 2,
    nodeId: 'visible-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-available',
    availabilitySource: 'publication',
    changedFields: [],
    nodeTitle: 'Evaluación final',
    recipientIds: ['student-id'],
  });
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
  expect(trigger).not.toHaveBeenCalled();
});
