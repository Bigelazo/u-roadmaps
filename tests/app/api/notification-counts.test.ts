import { beforeEach, expect, test, vi } from 'vitest';

const { database, transaction, session } = vi.hoisted(() => ({
  database: { $queryRaw: vi.fn(), $transaction: vi.fn() },
  transaction: {
    $queryRaw: vi.fn(),
    roadmapNode: { findFirst: vi.fn() },
    nodeChangeReview: { upsert: vi.fn() },
  },
  session: { userId: '11111111-1111-1111-1111-111111111111' },
}));
vi.mock('@/shared/server/db', async () => {
  const { sqltag, join, empty } = await import('@prisma/client/runtime/client');
  return { prisma: database, Prisma: { sql: sqltag, join, empty } };
});
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: session.userId }),
}));
import { GET } from '@/app/api/notifications/counts/route';
import {
  GET as getNodeChanges,
  POST as reviewNode,
} from '@/app/api/notifications/node-changes/route';
const roadmapId = '22222222-2222-2222-2222-222222222222';
const nodeId = '44444444-4444-4444-4444-444444444444';
beforeEach(() => {
  vi.clearAllMocks();
  database.$transaction.mockImplementation(async (work: (client: unknown) => unknown) =>
    work(transaction),
  );
});

test('counts use session identity and total the visible pending targets', async () => {
  database.$queryRaw.mockImplementation(async (query: { values: unknown[] }) =>
    query.values.includes('11111111-1111-1111-1111-111111111111') ? [{ count: BigInt(6) }] : [],
  );
  const request = () =>
    new Request(
      `http://localhost/api/notifications/counts?roadmapId=${roadmapId}&recipientId=someone-else`,
    );
  expect(await (await GET(request())).json()).toEqual({ count: 6 });
  session.userId = '33333333-3333-3333-3333-333333333333';
  expect(await (await GET(request())).json()).toEqual({ count: 0 });
  session.userId = '11111111-1111-1111-1111-111111111111';
});

test('Node change counts use session identity and group changed objects by Node', async () => {
  database.$queryRaw.mockImplementation(async (query: { values: unknown[] }) =>
    query.values.includes('11111111-1111-1111-1111-111111111111')
      ? [
          { nodeId: 'node-a', count: BigInt(2) },
          { nodeId: 'node-b', count: BigInt(1) },
        ]
      : [],
  );
  const request = () =>
    new Request(`http://localhost/api/notifications/node-changes?roadmapId=${roadmapId}`);
  expect(await (await getNodeChanges(request())).json()).toEqual({
    byNode: { 'node-a': 2, 'node-b': 1 },
  });
  const [query] = database.$queryRaw.mock.calls[0] as [{ sql: string }];
  expect(query.sql).toContain('"NodeChangeReview"');
  expect(query.sql).not.toContain('notice."acknowledgedAt" IS NULL');
  session.userId = '33333333-3333-3333-3333-333333333333';
  expect(await (await getNodeChanges(request())).json()).toEqual({ byNode: {} });
  session.userId = '11111111-1111-1111-1111-111111111111';
});

test.each(['', 'invalid'])(
  'Node change counts reject missing or invalid Roadmap identity: %s',
  async (id) => {
    const response = await getNodeChanges(
      new Request(`http://localhost/api/notifications/node-changes?roadmapId=${id}`),
    );
    expect(response.status).toBe(400);
    expect(database.$queryRaw).not.toHaveBeenCalled();
  },
);

const review = (body: unknown) =>
  reviewNode(
    new Request('http://localhost/api/notifications/node-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

test('opening a Node records its review for the session participant', async () => {
  transaction.$queryRaw.mockResolvedValue([{ isActive: true, noticeResetAt: null }]);
  transaction.roadmapNode.findFirst.mockResolvedValue({ id: nodeId });
  const response = await review({ roadmapId, nodeId, recipientId: 'someone-else' });
  expect(response.status).toBe(200);
  expect(transaction.roadmapNode.findFirst).toHaveBeenCalledWith({
    where: { id: nodeId, roadmapId },
    select: { id: true },
  });
  expect(transaction.nodeChangeReview.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { recipientId_nodeId: { recipientId: session.userId, nodeId } },
    }),
  );
});

test('a Node review requires an active Participation and a Node of that Roadmap', async () => {
  transaction.$queryRaw.mockResolvedValue([{ isActive: false, noticeResetAt: new Date() }]);
  expect((await review({ roadmapId, nodeId })).status).toBe(403);
  transaction.$queryRaw.mockResolvedValue([{ isActive: true, noticeResetAt: null }]);
  transaction.roadmapNode.findFirst.mockResolvedValue(null);
  expect((await review({ roadmapId, nodeId })).status).toBe(404);
  expect((await review({ roadmapId, nodeId: 'invalid' })).status).toBe(400);
  expect(transaction.nodeChangeReview.upsert).not.toHaveBeenCalled();
});
