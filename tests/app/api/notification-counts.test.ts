import { beforeEach, expect, test, vi } from 'vitest';

const { database, session } = vi.hoisted(() => ({
  database: { $queryRaw: vi.fn(), roadmapNotice: { count: vi.fn() } },
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
beforeEach(() => vi.clearAllMocks());

test('grouped counts use session identity and return node counts and the Roadmap total', async () => {
  database.$queryRaw.mockImplementation(async (query) => {
    expect(query.values).toEqual([session.userId, roadmapId]);
    expect(query.strings.join('')).toContain('"acknowledgedAt" IS NULL');
    return session.userId.startsWith('1')
      ? [
          { nodeId: 'node-a', count: BigInt(2) },
          { nodeId: 'node-b', count: BigInt(1) },
          { nodeId: null, count: BigInt(3) },
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
    expect(database.$queryRaw).not.toHaveBeenCalled();
  },
);
