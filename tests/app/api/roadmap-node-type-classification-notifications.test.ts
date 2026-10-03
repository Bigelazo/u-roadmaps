import { beforeEach, expect, test, vi } from 'vitest';

const {
  createRoadmapNodeType,
  updateRoadmapNodeType,
  deleteRoadmapNodeType,
  deliverRoadmapClassificationChange,
  calls,
} = vi.hoisted(() => ({
  createRoadmapNodeType: vi.fn(),
  updateRoadmapNodeType: vi.fn(),
  deleteRoadmapNodeType: vi.fn(),
  deliverRoadmapClassificationChange: vi.fn(async () => undefined),
  calls: [] as string[],
}));

vi.mock('@/app/_adapters/http', () => ({
  handleApplicationResult: (operation: () => Promise<Response>) => operation(),
  parseJsonObject: async (request: Request) => request.json(),
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
  createRoadmapNodeType,
  updateRoadmapNodeType,
  deleteRoadmapNodeType,
}));
vi.mock('@/features/notifications/server', () => ({ deliverRoadmapClassificationChange }));

import { POST as createNodeType } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/node-types/route';
import { PATCH } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/node-types/[typeId]/route';
import { DELETE as deleteNodeType } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/node-types/[typeId]/route';

const nodeType = {
  id: 'type-id',
  name: 'Lecturas guiadas',
  icon: 'BookOpen',
  color: '#024AD8',
  isPredefined: false,
};
const notification = {
  roadmapId: 'roadmap-id',
  previousTypeName: 'Lectura',
  nextTypeName: 'Lecturas guiadas',
  recipientIds: ['student-id'],
};
const context = {
  params: Promise.resolve({
    courseCode: 'CC3002',
    year: '2026',
    semester: '2',
    typeId: nodeType.id,
  }),
};

function result<T>(value: T) {
  return { match: async (onSuccess: (value: T) => unknown) => onSuccess(value) };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  createRoadmapNodeType.mockReturnValue(result(nodeType));
  updateRoadmapNodeType.mockImplementation(() => {
    calls.push('committed');
    return result({ nodeType, notification });
  });
  deliverRoadmapClassificationChange.mockImplementation(async () => {
    calls.push('delivered');
  });
  deleteRoadmapNodeType.mockReturnValue(result(undefined));
});

test('delivers the committed rename and keeps notification metadata out of the API response', async () => {
  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: nodeType.name }),
    }),
    context as never,
  );

  expect(calls).toEqual(['committed', 'delivered']);
  expect(deliverRoadmapClassificationChange).toHaveBeenCalledExactlyOnceWith({
    userId: 'teacher-id',
    identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
    ...notification,
  });
  expect(await response.json()).toEqual({ nodeType });
});

test('does not deliver when the confirmed update has no classification notice', async () => {
  updateRoadmapNodeType.mockImplementation(() => result({ nodeType }));

  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ color: nodeType.color }),
    }),
    context as never,
  );

  expect(deliverRoadmapClassificationChange).not.toHaveBeenCalled();
  expect(await response.json()).toEqual({ nodeType });
});

test('creating and deleting an unused type do not deliver classification notices', async () => {
  const created = await createNodeType(
    new Request('http://localhost/node-types', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: nodeType.name, icon: nodeType.icon, color: nodeType.color }),
    }),
    context as never,
  );
  const deleted = await deleteNodeType(
    new Request('http://localhost/node-types/type-id', { method: 'DELETE' }),
    context as never,
  );

  expect(created.status).toBe(201);
  expect(deleted.status).toBe(204);
  expect(deliverRoadmapClassificationChange).not.toHaveBeenCalled();
});

test('a delivery failure does not change the successful type update response', async () => {
  deliverRoadmapClassificationChange.mockRejectedValueOnce(
    new Error('Notice persistence unavailable'),
  );

  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: nodeType.name }),
    }),
    context as never,
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ nodeType });
});
