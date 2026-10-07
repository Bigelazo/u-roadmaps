import { beforeEach, expect, test, vi } from 'vitest';

const { database, session } = vi.hoisted(() => ({
  database: {
    roadmapNotice: { findMany: vi.fn() },
    participation: { findFirst: vi.fn() },
    roadmapNode: { findMany: vi.fn() },
    dependency: { findMany: vi.fn() },
    completion: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  session: { userId: '11111111-1111-1111-1111-111111111111' },
}));
vi.mock('@/shared/server/db', () => ({
  prisma: database,
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: session.userId }),
}));
import { GET } from '@/app/api/notifications/counts/route';
const roadmapId = '22222222-2222-2222-2222-222222222222';
beforeEach(() => {
  vi.clearAllMocks();
  database.$transaction.mockImplementation(async (operation) => operation(database));
  database.participation.findFirst.mockResolvedValue({ id: 'participation', role: 'TEACHER' });
  database.roadmapNode.findMany.mockResolvedValue([
    { id: 'node-a', isVisible: true, isTeacherBlocked: false },
    { id: 'node-b', isVisible: true, isTeacherBlocked: false },
    { id: 'blocked', isVisible: true, isTeacherBlocked: true },
  ]);
  database.dependency.findMany.mockResolvedValue([]);
  database.completion.findMany.mockResolvedValue([]);
});

test('grouped counts use session identity and exclude invisible targets from Node and Roadmap totals', async () => {
  database.roadmapNotice.findMany.mockImplementation(async ({ where }) => {
    expect(where.acknowledgedAt).toBeNull();
    return where.recipientId === '11111111-1111-1111-1111-111111111111'
      ? [
          { roadmapId, data: { nodeId: 'node-a', noticeTarget: 'node-title' } },
          { roadmapId, data: { nodeId: 'node-a', noticeTarget: 'node-type' } },
          { roadmapId, data: { nodeId: 'node-b', noticeTarget: 'node-title' } },
          { roadmapId, data: { changeKind: 'roadmap-available' } },
          { roadmapId, data: { changeKind: 'classification-updated' } },
          { roadmapId, data: { changeKind: 'dependency-added' } },
          { roadmapId, data: { nodeId: 'blocked', noticeTarget: 'node-description' } },
        ]
      : [];
  });
  const request = () =>
    new Request(
      `http://localhost/api/notifications/counts?roadmapId=${roadmapId}&groupBy=nodeId&recipientId=someone-else`,
    );
  expect(await (await GET(request())).json()).toEqual({
    count: 6,
    byNode: { 'node-a': 2, 'node-b': 1 },
  });
  session.userId = '33333333-3333-3333-3333-333333333333';
  expect(await (await GET(request())).json()).toEqual({ count: 0, byNode: {} });
  session.userId = '11111111-1111-1111-1111-111111111111';
});

test.each(['', 'invalid'])(
  'grouped counts reject missing or invalid Roadmap identity: %s',
  async (id) => {
    const response = await GET(
      new Request(`http://localhost/api/notifications/counts?groupBy=nodeId&roadmapId=${id}`),
    );
    expect(response.status).toBe(400);
    expect(database.roadmapNotice.findMany).not.toHaveBeenCalled();
  },
);
