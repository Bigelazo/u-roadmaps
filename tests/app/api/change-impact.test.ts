// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const { readRoadmapChangeImpact } = vi.hoisted(() => ({ readRoadmapChangeImpact: vi.fn() }));

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  synchronizeSessionParticipation: async () => undefined,
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/features/roadmap/server', () => ({ readRoadmapChangeImpact }));

import { GET } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/change-impact/route';

const context = {
  params: Promise.resolve({ courseCode: 'CC3002', year: '2026', semester: '2' }),
};

beforeEach(() => {
  vi.clearAllMocks();
  readRoadmapChangeImpact.mockResolvedValue({ version: 'impact-version' });
});

test.each<Record<string, string>>([
  { kind: 'hide-node', nodeId: 'node-id' },
  { kind: 'change-teacher-block', nodeId: 'node-id', operation: 'BRANCH_UNLOCK' },
  {
    kind: 'create-dependency',
    sourceNodeId: 'source-id',
    targetNodeId: 'target-id',
    sourceHandle: 'bottom',
    targetHandle: '',
  },
])(
  'forwards exactly the present change fields of %o and returns the Change impact',
  async (input) => {
    const response = await GET(
      new Request(
        `http://localhost/change-impact?${new URLSearchParams({ ...input, schedule: 'ignored' })}`,
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ version: 'impact-version' });
    expect(readRoadmapChangeImpact).toHaveBeenCalledExactlyOnceWith({
      userId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      input,
    });
  },
);
