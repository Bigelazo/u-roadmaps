import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma, ensureSubscribers, trigger } = vi.hoisted(() => ({
  prisma: {
    roadmapNode: { findUnique: vi.fn(), findMany: vi.fn() },
    participation: { findMany: vi.fn() },
    dependency: { findMany: vi.fn() },
    completion: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    roadmapNotice: { createMany: vi.fn() },
  },
  ensureSubscribers: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('@/features/notifications/infrastructure/novu-transport', () => ({
  novuTransport: { ensureSubscribers, trigger },
}));

import { deliverResourceChange } from '@/features/notifications/server';

const input = {
  userId: 'author-id',
  identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
  nodeId: 'node-id',
  resourceTitle: 'Guía de ejercicios',
  changeKind: 'resource-added' as const,
};

beforeEach(() => {
  vi.stubEnv('NOVU_SECRET_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER', '');
  prisma.roadmapNode.findUnique.mockResolvedValue({
    id: input.nodeId,
    title: 'Unidad 1',
    roadmapId: 'roadmap-id',
    isVisible: true,
    isTeacherBlocked: false,
    roadmap: {
      courseOffering: {
        id: 'offering-id',
        courseCode: 'CC3002',
        year: 2026,
        semester: 2,
        course: { name: 'Diseño de software' },
      },
    },
  });
  prisma.participation.findMany
    .mockResolvedValueOnce([
      { userId: 'teacher-id', role: 'TEACHER', user: { id: 'teacher-id', name: 'Docente B' } },
      { userId: 'student-id', role: 'STUDENT', user: { id: 'student-id', name: 'Estudiante A' } },
    ])
    .mockImplementation(async (query: { where: { userId: { in: string[] } } }) =>
      query.where.userId.in.map((userId) => ({ userId })),
    );
  prisma.roadmapNode.findMany.mockResolvedValue([{ id: input.nodeId, isTeacherBlocked: false }]);
  prisma.dependency.findMany.mockResolvedValue([]);
  prisma.completion.findMany.mockResolvedValue([]);
  prisma.user.findUnique.mockResolvedValue({ name: 'Docente autora' });
  ensureSubscribers.mockResolvedValue(undefined);
  trigger.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

test('stores an own Resource notice for eligible recipients without Novu configuration', async () => {
  await deliverResourceChange(input);

  expect(prisma.participation.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        courseOfferingId: 'offering-id',
        isActive: true,
        userId: { not: 'author-id' },
      }),
    }),
  );
  expect(ensureSubscribers).not.toHaveBeenCalled();
  expect(trigger).not.toHaveBeenCalled();
  const records = prisma.roadmapNotice.createMany.mock.calls[0]?.[0].data;
  expect(records).toHaveLength(2);
  expect(records.map(({ recipientId }: { recipientId: string }) => recipientId).sort()).toEqual([
    'student-id',
    'teacher-id',
  ]);
  expect(records[0]).toMatchObject({
    eventId: expect.any(String),
    roadmapId: 'roadmap-id',
    courseOfferingId: 'offering-id',
    subject: 'Cambio de recurso: Guía de ejercicios',
    body: 'Docente autora modificó un recurso en un Nodo del Roadmap de CC3002.',
    data: {
      targetKind: 'node',
      nodeId: input.nodeId,
      nodeTitle: 'Unidad 1',
      changeKind: 'resource-added',
      resourceTitle: input.resourceTitle,
      actorName: 'Docente autora',
      occurredAt: expect.any(String),
    },
  });
  expect(JSON.stringify(records)).not.toMatch(/https?:|description|bytes/i);
  expect(prisma.completion.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ userId: { in: ['student-id'] } }) }),
  );
});

test('does not deliver a Resource notice when the owning Node is blocked', async () => {
  prisma.roadmapNode.findUnique.mockResolvedValueOnce({
    id: input.nodeId,
    title: 'Unidad 1',
    roadmapId: 'roadmap-id',
    isVisible: true,
    isTeacherBlocked: true,
    roadmap: {
      courseOffering: {
        id: 'offering-id',
        courseCode: 'CC3002',
        year: 2026,
        semester: 2,
        course: { name: 'Diseño de software' },
      },
    },
  });
  prisma.roadmapNode.findMany.mockResolvedValueOnce([{ id: input.nodeId, isTeacherBlocked: true }]);
  prisma.participation.findMany.mockResolvedValueOnce([
    { userId: 'teacher-id', role: 'TEACHER', user: { id: 'teacher-id', name: 'Docente B' } },
    { userId: 'student-id', role: 'STUDENT', user: { id: 'student-id', name: 'Estudiante A' } },
  ]);

  await deliverResourceChange(input);

  expect(prisma.roadmapNotice.createMany).not.toHaveBeenCalled();
});

test('keeps teachers eligible when students cannot access the Node through prerequisites', async () => {
  prisma.participation.findMany.mockReset();
  prisma.participation.findMany
    .mockResolvedValueOnce([
      { userId: 'teacher-id', role: 'TEACHER', user: { id: 'teacher-id', name: 'Docente B' } },
      { userId: 'student-id', role: 'STUDENT', user: { id: 'student-id', name: 'Estudiante A' } },
    ])
    .mockImplementation(async (query: { where: { userId: { in: string[] } } }) =>
      query.where.userId.in.map((userId) => ({ userId })),
    );
  prisma.roadmapNode.findMany.mockResolvedValueOnce([
    { id: 'prerequisite-id', isTeacherBlocked: true },
    { id: input.nodeId, isTeacherBlocked: false },
  ]);
  prisma.dependency.findMany.mockResolvedValueOnce([
    { sourceNodeId: 'prerequisite-id', targetNodeId: input.nodeId },
  ]);

  await deliverResourceChange(input);

  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: [expect.objectContaining({ recipientId: 'teacher-id' })],
    }),
  );
  expect(prisma.completion.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ userId: { in: ['student-id'] } }) }),
  );
});
