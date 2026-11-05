// @vitest-environment node
vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApplicationError } from '@/shared/errors/types';

const { createRoadmapNodeType, updateRoadmapNodeType, deleteRoadmapNodeType, calls } = vi.hoisted(
  () => ({
    createRoadmapNodeType: vi.fn(),
    updateRoadmapNodeType: vi.fn(),
    deleteRoadmapNodeType: vi.fn(),
    calls: [] as string[],
  }),
);

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
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

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  createRoadmapNodeType.mockResolvedValue(nodeType);
  updateRoadmapNodeType.mockImplementation(async () => {
    calls.push('committed');
    return { nodeType };
  });
  deleteRoadmapNodeType.mockResolvedValue(undefined);
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
  updateRoadmapNodeType.mockResolvedValue({ nodeType });

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
  await expect(created.json()).resolves.toEqual({ nodeType });
  expect(deleted.status).toBe(204);
  await expect(deleted.text()).resolves.toBe('');
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

test.each([
  {
    name: 'typed name conflict',
    failure: new ApplicationError(
      409,
      'NODE_TYPE_NAME_CONFLICT',
      'Ya existe un tipo con ese nombre.',
    ),
    status: 409,
    error: { code: 'NODE_TYPE_NAME_CONFLICT', message: 'Ya existe un tipo con ese nombre.' },
  },
  {
    name: 'unexpected type failure',
    failure: new Error('SECRET SQL'),
    status: 500,
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
  },
])('serializes a $name', async ({ failure, status, error }) => {
  if (!(failure instanceof ApplicationError))
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  updateRoadmapNodeType.mockRejectedValue(failure);
  const response = await PATCH(
    new Request('http://localhost/node-types/type-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: nodeType.name }),
    }),
    context,
  );
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
});
