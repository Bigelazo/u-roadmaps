import { beforeEach, expect, test, vi } from 'vitest';

const {
  createRoadmapDependency,
  deleteRoadmapDependency,
  previewRoadmapDependency,
  deliverRoadmapDependencyNotifications,
  after,
  afterTasks,
  sequence,
} = vi.hoisted(() => ({
  createRoadmapDependency: vi.fn(),
  deleteRoadmapDependency: vi.fn(),
  previewRoadmapDependency: vi.fn(),
  deliverRoadmapDependencyNotifications: vi.fn(async () => {
    sequence.push('deliver');
  }),
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
vi.mock('@/app/_adapters/roadmap-dependency-notifications', () => ({
  deliverRoadmapDependencyNotifications,
}));
vi.mock('@/features/roadmap/server', () => ({
  createRoadmapDependency,
  deleteRoadmapDependency,
  previewRoadmapDependency,
}));

import { POST } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/dependencies/route';
import { DELETE } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/dependencies/[dependencyId]/route';

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
const notifications = {
  path: {
    roadmapId: 'roadmap-id',
    changeKind: 'dependency-added' as const,
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
    recipientIds: ['student-id'],
  },
  nodes: [],
};

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

test('POST prepares notices after the confirmed mutation before returning its response', async () => {
  const mutation = {
    dependency: { id: 'dependency-id', sourceNodeId: 'source-id', targetNodeId: 'target-id' },
    nodes: [{ id: 'target-id', title: 'Evaluación 1' }],
    notifications,
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
  expect(deliverRoadmapDependencyNotifications).toHaveBeenCalledExactlyOnceWith({
    actorId: 'teacher-id',
    identifier,
    notifications,
  });
  expect(sequence).toEqual(['mutation-committed', 'deliver']);
});

test('POST does not deliver when the confirmed Dependency action fails', async () => {
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
  expect(deliverRoadmapDependencyNotifications).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
});

test('DELETE prepares route and access notices while keeping its 204 response', async () => {
  deleteRoadmapDependency.mockReturnValue(
    result({
      notifications: {
        ...notifications,
        path: {
          ...notifications.path,
          changeKind: 'dependency-removed' as const,
        },
      },
    }),
  );

  const response = await DELETE(
    new Request('http://localhost/dependencies/dependency-id'),
    context as never,
  );

  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(deleteRoadmapDependency).toHaveBeenCalledWith({
    userId: 'teacher-id',
    identifier,
    id: 'dependency-id',
  });
  expect(after).not.toHaveBeenCalled();
  expect(deliverRoadmapDependencyNotifications).toHaveBeenCalledExactlyOnceWith({
    actorId: 'teacher-id',
    identifier,
    notifications: {
      ...notifications,
      path: { ...notifications.path, changeKind: 'dependency-removed' },
    },
  });
  expect(sequence).toEqual(['mutation-committed', 'deliver']);
});
