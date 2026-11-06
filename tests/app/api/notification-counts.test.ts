// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApplicationError } from '@/shared/errors/types';

const { countOwnNotices, countOwnNodeChangeTargets, reviewOwnNode, session } = vi.hoisted(() => ({
  countOwnNotices: vi.fn(),
  countOwnNodeChangeTargets: vi.fn(),
  reviewOwnNode: vi.fn(),
  session: { userId: '11111111-1111-1111-1111-111111111111' },
}));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/features/notifications/server', () => ({
  countOwnNotices,
  countOwnNodeChangeTargets,
  reviewOwnNode,
}));
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
const query = new URLSearchParams({
  roadmapId,
  recipientId: 'someone-else',
  courseCode: 'CC3002',
  year: '2026',
  semester: '2',
});
const body = { roadmapId, nodeId, recipientId: 'someone-else' };
const reviewRequest = () =>
  new Request('http://localhost/api/notifications/node-changes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  session.userId = '11111111-1111-1111-1111-111111111111';
});
afterEach(() => vi.restoreAllMocks());

test.each([
  {
    name: 'pending counts',
    path: 'counts',
    handler: GET,
    operation: countOwnNotices,
    result: { count: 6 },
  },
  {
    name: 'Node change marks',
    path: 'node-changes',
    handler: getNodeChanges,
    operation: countOwnNodeChangeTargets,
    result: { byNode: { [nodeId]: 2 } },
  },
])(
  '$name forwards session identity and query parameters and serializes its result',
  async ({ handler, operation, result, path }) => {
    operation.mockResolvedValue(result);
    const response = await handler(
      new Request(`http://localhost/api/notifications/${path}?${query}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual(result);
    const [userId, forwarded] = operation.mock.calls[0];
    expect(userId).toBe(session.userId);
    expect(forwarded).toBeInstanceOf(URLSearchParams);
    expect([...forwarded.entries()]).toEqual([...query.entries()]);
  },
);

test('Node review forwards the parsed body with session identity despite a supplied recipient', async () => {
  session.userId = '33333333-3333-3333-3333-333333333333';
  reviewOwnNode.mockResolvedValue({ reviewed: true });
  const response = await reviewNode(reviewRequest());
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ reviewed: true });
  expect(reviewOwnNode).toHaveBeenCalledWith(session.userId, body);
});

test.each([
  {
    name: 'pending counts',
    handler: GET,
    operation: countOwnNotices,
    request: () => new Request(`http://localhost/api/notifications/counts?${query}`),
  },
  {
    name: 'Node change marks',
    handler: getNodeChanges,
    operation: countOwnNodeChangeTargets,
    request: () => new Request(`http://localhost/api/notifications/node-changes?${query}`),
  },
  { name: 'Node review', handler: reviewNode, operation: reviewOwnNode, request: reviewRequest },
])(
  '$name translates typed and unexpected operation failures through the real HTTP pipeline',
  async ({ operation, handler, request }) => {
    operation.mockRejectedValueOnce(
      new ApplicationError(400, 'INVALID_REQUEST', 'Identidad de aviso inválida.'),
    );
    const refused = await handler(request());
    expect(refused.status).toBe(400);
    await expect(refused.json()).resolves.toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Identidad de aviso inválida.' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    operation.mockRejectedValueOnce(new Error('SECRET SQL connection password and stack'));
    const failed = await handler(request());
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
    });
  },
);
