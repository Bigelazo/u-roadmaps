vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { beforeEach, expect, test, vi } from 'vitest';

const {
  createRoadmapDependency,
  deleteRoadmapDependency,
  previewRoadmapDependency,
  after,
  afterTasks,
  sequence,
} = vi.hoisted(() => ({
  createRoadmapDependency: vi.fn(),
  deleteRoadmapDependency: vi.fn(),
  previewRoadmapDependency: vi.fn(),
  after: vi.fn((task: () => void | Promise<void>) => {
    afterTasks.push(task);
    sequence.push('scheduled');
  }),
  afterTasks: [] as Array<() => void | Promise<void>>,
  sequence: [] as string[],
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after,
}));

vi.mock('@/app/_adapters/http', () => ({
  handleApplicationResult: (operation: () => Promise<Response>) => operation(),
  parseJsonObject: (request: Request) => request.json(),
  throwApplicationError: (error: unknown): never => {
    throw error;
  },
}));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/app/_adapters/roadmap', () => ({
  requireCourseOfferingIdentifier: () => ({ courseCode: 'CC3002', year: 2026, semester: 2 }),
}));
vi.mock('@/features/roadmap/server', () => ({
  createRoadmapDependency,
  deleteRoadmapDependency,
  previewRoadmapDependency,
}));

import { POST } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/dependencies/route';
import { DELETE } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/dependencies/[dependencyId]/route';

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
function result<T>(value: T) {
  return {
    match: async (onSuccess: (value: T) => unknown) => {
      sequence.push('mutation-committed');
      return onSuccess(value);
    },
  };
}

const context = {
  params: Promise.resolve({
    courseCode: 'CC3002',
    year: '2026',
    semester: '2',
    dependencyId: 'dependency-id',
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  sequence.length = 0;
  afterTasks.length = 0;
});

test('POST returns the plain confirmed mutation', async () => {
  const mutation = {
    dependency: { id: 'dependency-id', sourceNodeId: 'source-id', targetNodeId: 'target-id' },
    nodes: [{ id: 'target-id', title: 'Evaluación 1' }],
  };
  createRoadmapDependency.mockReturnValue(result(mutation));

  const response = await POST(
    new Request('http://localhost/dependencies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceNodeId: 'source-id', targetNodeId: 'target-id' }),
    }),
    context as never,
  );

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ dependency: mutation.dependency, nodes: mutation.nodes });
  expect(after).not.toHaveBeenCalled();
  expect(sequence).toEqual(['mutation-committed']);
});

test('POST returns a failed Dependency action', async () => {
  const error = new Error('DEPENDENCY_CYCLE');
  createRoadmapDependency.mockReturnValue({
    match: async (_onSuccess: (value: unknown) => unknown, onError: (error: Error) => unknown) =>
      onError(error),
  });

  await expect(
    POST(
      new Request('http://localhost/dependencies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceNodeId: 'source-id', targetNodeId: 'target-id' }),
      }),
      context as never,
    ),
  ).rejects.toThrow('DEPENDENCY_CYCLE');
  expect(after).not.toHaveBeenCalled();
});

test('DELETE returns an empty 204 response', async () => {
  deleteRoadmapDependency.mockReturnValue(result({}));

  const response = await DELETE(
    new Request('http://localhost/dependencies/dependency-id'),
    context as never,
  );

  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(deleteRoadmapDependency).toHaveBeenCalledWith(
    {
      userId: 'teacher-id',
      identifier,
      id: 'dependency-id',
    },
    expect.any(Object),
  );
  expect(after).not.toHaveBeenCalled();
  expect(sequence).toEqual(['mutation-committed']);
});
