// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { createRoadmapNode, saveRoadmapNodePositions, requireAuthenticatedUser } = vi.hoisted(
  () => ({
    createRoadmapNode: vi.fn(),
    saveRoadmapNodePositions: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  }),
);

vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser,
  synchronizeSessionParticipation: async () => undefined,
}));
vi.mock('@/features/roadmap/server', () => ({ createRoadmapNode, saveRoadmapNodePositions }));

import { PATCH } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/placement/route';
import { POST } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/route';

const positions = [
  { nodeId: '19ae313e-9c5f-4d20-a3ee-fd0d51738a73', position: { x: 40, y: 240 } },
  { nodeId: '819814b4-1007-4cb8-9bec-5299cf07086c', position: { x: 200, y: 240 } },
];
const context = {
  params: Promise.resolve({ courseCode: ' CC3002 ', year: '2026', semester: '2' }),
};
const request = (body: unknown) =>
  new Request('http://localhost/placement', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ id: 'teacher-id' });
  saveRoadmapNodePositions.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

test('one authenticated request carries the complete placement and returns only after commit', async () => {
  const response = await PATCH(request({ positions }), context as never);
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(saveRoadmapNodePositions).toHaveBeenCalledExactlyOnceWith(
    {
      userId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      input: { positions },
    },
    {},
  );
});

test('malformed JSON is rejected before persistence', async () => {
  const response = await PATCH(
    new Request('http://localhost/placement', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }),
    context as never,
  );
  expect(response.status).toBe(400);
  expect(saveRoadmapNodePositions).not.toHaveBeenCalled();
});

test('creation transports its retained identity and complete displacements through authenticated HTTP', async () => {
  const input = {
    nodeId: '43d60763-88a6-48fb-9471-3eaf21d508d2',
    title: 'Límites',
    description: null,
    nodeTypeId: '4a1b1ef9-60c2-4421-aa18-e0378e82d186',
    positionX: 40,
    positionY: 80,
    displaced: positions,
  };
  const node = { id: input.nodeId, title: input.title };
  createRoadmapNode.mockResolvedValue(node);
  const response = await POST(request(input), context as never);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ node });
  expect(createRoadmapNode).toHaveBeenCalledExactlyOnceWith(
    {
      userId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      input,
    },
    {},
  );
});
