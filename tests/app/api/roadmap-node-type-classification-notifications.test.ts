vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { beforeEach, expect, test, vi } from 'vitest';

const { createRoadmapNodeType, updateRoadmapNodeType, deleteRoadmapNodeType, calls } = vi.hoisted(
  () => ({
    createRoadmapNodeType: vi.fn(),
    updateRoadmapNodeType: vi.fn(),
    deleteRoadmapNodeType: vi.fn(),
    calls: [] as string[],
  }),
);

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
    return result({ nodeType });
  });
  deleteRoadmapNodeType.mockReturnValue(result(undefined));
});

test('returns the committed rename as a plain response', async () => {
  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: nodeType.name }),
    }),
    context as never,
  );

  expect(calls).toEqual(['committed']);
  expect(await response.json()).toEqual({ nodeType });
});

test('returns the type after an appearance edit', async () => {
  updateRoadmapNodeType.mockImplementation(() => result({ nodeType }));

  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ color: nodeType.color }),
    }),
    context as never,
  );

  expect(await response.json()).toEqual({ nodeType });
});

test('creating and deleting an unused type keep their status codes', async () => {
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
});

test('a confirmed type update returns HTTP 200', async () => {
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
