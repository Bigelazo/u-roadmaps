import { beforeEach, expect, test, vi } from 'vitest';

const { prisma, transaction, state } = vi.hoisted(() => {
  const state = {
    nodeUsages: [{ isVisible: true }, { isVisible: true }],
    nodeType: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Lectura',
      icon: 'BookOpen',
      color: '#024AD8',
      isPredefined: false,
    },
    participants: [
      { userId: 'teacher-id', isActive: true },
      { userId: 'student-one', isActive: true },
      { userId: 'student-two', isActive: true },
    ],
  };
  const transaction = {
    courseOffering: { findUnique: vi.fn() },
    participation: { findUnique: vi.fn(), findMany: vi.fn() },
    nodeType: { findFirst: vi.fn(), update: vi.fn() },
    roadmapNode: { count: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  return { state, transaction, prisma: { $transaction: vi.fn() } };
});

vi.mock('@/shared/server/db', () => ({
  prisma,
  Prisma: {
    TransactionIsolationLevel: { Serializable: 'Serializable' },
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
  },
}));

import { updateRoadmapNode, updateRoadmapNodeType } from '@/features/roadmap/application/editor';

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
const typeId = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  state.nodeUsages = [{ isVisible: true }, { isVisible: true }];
  state.nodeType = {
    id: typeId,
    name: 'Lectura',
    icon: 'BookOpen',
    color: '#024AD8',
    isPredefined: false,
  };
  state.participants = [
    { userId: 'teacher-id', isActive: true },
    { userId: 'student-one', isActive: true },
    { userId: 'student-two', isActive: true },
  ];
  prisma.$transaction.mockImplementation(
    (operation: (tx: typeof transaction) => Promise<unknown>) =>
      Promise.resolve(operation(transaction)),
  );
  transaction.courseOffering.findUnique.mockResolvedValue({
    id: 'offering-id',
    roadmap: { id: 'roadmap-id', courseOfferingId: 'offering-id' },
  });
  transaction.participation.findUnique.mockResolvedValue({ isActive: true, role: 'TEACHER' });
  transaction.participation.findMany.mockImplementation(async () =>
    state.participants.filter(({ isActive }) => isActive),
  );
  transaction.nodeType.findFirst.mockImplementation(async (query: { where: { id?: string } }) =>
    query.where.id ? { ...state.nodeType, id: query.where.id } : null,
  );
  transaction.nodeType.update.mockImplementation(
    async (query: { data: Partial<typeof state.nodeType> }) => ({
      ...state.nodeType,
      ...query.data,
    }),
  );
  transaction.roadmapNode.count.mockImplementation(
    async (query: { where: { isVisible?: boolean } }) =>
      state.nodeUsages.filter(
        ({ isVisible }) =>
          query.where.isVisible === undefined || query.where.isVisible === isVisible,
      ).length,
  );
});

async function updateType(input: Record<string, unknown>) {
  return updateRoadmapNodeType({ userId: 'teacher-id', identifier, id: typeId, input }).match(
    (value) => value,
    (error) => Promise.reject(error),
  );
}

test('one confirmed rename notifies active participants once for a type used by multiple visible Nodes', async () => {
  const result = await updateType({ name: 'Lecturas guiadas' });

  expect(transaction.roadmapNode.count).toHaveBeenCalledWith({
    where: { roadmapId: 'roadmap-id', nodeTypeId: typeId, isVisible: true },
  });
  expect(transaction.participation.findMany).toHaveBeenCalledWith({
    where: { courseOfferingId: 'offering-id', isActive: true },
    select: { userId: true, isActive: true },
  });
  expect(result).toEqual({
    nodeType: {
      id: typeId,
      name: 'Lecturas guiadas',
      icon: 'BookOpen',
      color: '#024AD8',
      isPredefined: false,
    },
    notification: {
      roadmapId: 'roadmap-id',
      previousTypeName: 'Lectura',
      nextTypeName: 'Lecturas guiadas',
      recipientIds: ['student-one', 'student-two'],
    },
  });
});

test.each([
  ['used only by hidden Nodes', [{ isVisible: false }]],
  ['unused', []],
])('does not notify when the type is %s', async (_description, nodeUsages) => {
  state.nodeUsages = nodeUsages;

  const result = await updateType({ name: 'Lecturas guiadas' });

  expect(result.notification).toBeUndefined();
});

test('does not notify for an unchanged name or an appearance-only edit', async () => {
  const unchanged = await updateType({ name: 'Lectura' });

  expect(unchanged.notification).toBeUndefined();
  expect(transaction.roadmapNode.count).not.toHaveBeenCalled();

  const appearanceOnly = await updateType({ icon: 'BookText', color: '#1467A8' });

  expect(appearanceOnly.notification).toBeUndefined();
  expect(transaction.roadmapNode.count).not.toHaveBeenCalled();
});

test('reassigning a Node to another type stays a Node update', async () => {
  const nodeId = '22222222-2222-4222-8222-222222222222';
  const nextTypeId = '33333333-3333-4333-8333-333333333333';
  transaction.roadmapNode.findFirst.mockResolvedValue({
    id: nodeId,
    roadmapId: 'roadmap-id',
    nodeTypeId: typeId,
    title: 'Lectura de límites',
    description: null,
    positionX: 120,
    positionY: 160,
    isVisible: true,
    isTeacherBlocked: false,
  });
  transaction.roadmapNode.update.mockImplementation(
    async (query: { data: { nodeTypeId?: string } }) => ({
      id: nodeId,
      roadmapId: 'roadmap-id',
      nodeTypeId: query.data.nodeTypeId,
      title: 'Lectura de límites',
      description: null,
      positionX: 120,
      positionY: 160,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    }),
  );

  const result = await updateRoadmapNode({
    userId: 'teacher-id',
    identifier,
    id: nodeId,
    input: { nodeTypeId: nextTypeId },
  }).match(
    (value) => value,
    (error) => Promise.reject(error),
  );

  expect(result.notification).toEqual({ kind: 'node-updated', changedFields: ['nodeType'] });
  expect(result).not.toHaveProperty('notifications');
  expect(transaction.roadmapNode.count).not.toHaveBeenCalled();
});
