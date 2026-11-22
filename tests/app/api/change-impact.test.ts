// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const { roadmapRead, planChange } = vi.hoisted(() => {
  const emptyRows = { findMany: async () => [] };
  const tx = { roadmapNode: emptyRows, dependency: emptyRows, nodeType: emptyRows };
  return {
    roadmapRead: vi.fn(
      async (
        _participant: unknown,
        _capability: unknown,
        read: (context: { tx: unknown; roadmap: { id: string } }) => Promise<unknown>,
      ) => read({ tx, roadmap: { id: 'roadmap-id' } }),
    ),
    planChange: vi.fn(() => ({ kind: 'ALLOWED', impact: { version: 'impact-version' } })),
  };
});

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  synchronizeSessionParticipation: async () => undefined,
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/features/roadmap/application/roadmap-command', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  roadmapRead,
}));
vi.mock('@/features/roadmap/domain/change-impact', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  planChange,
}));

import { GET } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/change-impact/route';

const nodeId = '19ae313e-9c5f-4d20-a3ee-fd0d51738a73';
const targetNodeId = '819814b4-1007-4cb8-9bec-5299cf07086c';
const context = {
  params: Promise.resolve({ courseCode: 'CC3002', year: '2026', semester: '2' }),
};
const read = (query: Record<string, string>) =>
  GET(
    new Request(`http://localhost/change-impact?${new URLSearchParams(query)}`),
    context as never,
  );

beforeEach(() => vi.clearAllMocks());

test.each<{ query: Record<string, string>; change: object }>([
  { query: { kind: 'hide-node', nodeId }, change: { kind: 'hide-node', nodeId } },
  { query: { kind: 'delete-node', nodeId }, change: { kind: 'delete-node', nodeId } },
  {
    query: { kind: 'change-teacher-block', nodeId, operation: 'BRANCH_UNLOCK' },
    change: { kind: 'change-teacher-block', nodeId, operation: 'BRANCH_UNLOCK' },
  },
  {
    query: {
      kind: 'create-dependency',
      sourceNodeId: nodeId,
      targetNodeId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
    change: { kind: 'create-dependency', sourceNodeId: nodeId, targetNodeId },
  },
])('$query.kind reads the Change impact of the parsed change', async ({ query, change }) => {
  const response = await read(query);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ version: 'impact-version' });
  expect(roadmapRead).toHaveBeenCalledExactlyOnceWith(
    { userId: 'teacher-id', identifier: { courseCode: 'CC3002', year: 2026, semester: 2 } },
    'edit',
    expect.any(Function),
  );
  expect(planChange).toHaveBeenCalledExactlyOnceWith(expect.anything(), change);
});

test.each<Record<string, string>>([
  { kind: 'show-node', nodeId },
  { kind: 'hide-node', nodeId: 'not-a-node' },
  { kind: 'change-teacher-block', nodeId, operation: 'HIDE' },
  { kind: 'create-dependency', sourceNodeId: nodeId, targetNodeId, sourceHandle: 'middle' },
])('refuses %o as an invalid request before reading the Roadmap', async (query) => {
  const response = await read(query);

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  expect(roadmapRead).not.toHaveBeenCalled();
});
