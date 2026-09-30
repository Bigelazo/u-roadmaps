import { beforeEach, expect, test, vi } from 'vitest';

const { createResource, uploadResource, updateResource, removeResource, deliverResourceChange } =
  vi.hoisted(() => ({
    createResource: vi.fn(),
    uploadResource: vi.fn(),
    updateResource: vi.fn(),
    removeResource: vi.fn(),
    deliverResourceChange: vi.fn(async () => undefined),
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
  createRoadmapResource: createResource,
  uploadRoadmapResource: uploadResource,
  updateRoadmapResource: updateResource,
  removeRoadmapResource: removeResource,
  getRoadmapNodeResources: vi.fn(),
}));
vi.mock('@/features/notifications/server', () => ({ deliverResourceChange }));

import { POST } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/resources/route';
import {
  DELETE,
  PATCH,
} from '@/app/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]/route';

const resource = { id: 'resource-id', title: 'Guía del curso' };
const context = {
  params: Promise.resolve({
    courseCode: 'CC3002',
    year: '2026',
    semester: '2',
    nodeId: 'node-id',
    resourceId: 'resource-id',
  }),
};

function result<T>(value: T) {
  return { match: async (onSuccess: (value: T) => unknown) => onSuccess(value) };
}

function fileUploadRequest() {
  return {
    headers: new Headers({ 'content-type': 'multipart/form-data' }),
    formData: async () => ({ get: () => ({ name: 'Guía del curso.pdf' }) }),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  createResource.mockReturnValue(result(resource));
  uploadResource.mockReturnValue(result(resource));
  updateResource.mockReturnValue(
    result({ resource, notification: { nodeId: 'node-id', resourceTitle: resource.title } }),
  );
  removeResource.mockReturnValue(result({ nodeId: 'node-id', resourceTitle: resource.title }));
});

test.each(['LINK', 'VIDEO'] as const)('emits a confirmed %s Resource addition', async (type) => {
  const response = await POST(
    new Request('http://localhost/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: resource.title, url: 'https://example.test/resource', type }),
    }),
    context as never,
  );

  expect(response.status).toBe(201);
  expect(deliverResourceChange).toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'node-id',
      resourceTitle: resource.title,
      changeKind: 'resource-added',
    }),
  );
});

test('emits a confirmed file addition through its Resource', async () => {
  const response = await POST(fileUploadRequest(), context as never);

  expect(response.status).toBe(201);
  expect(uploadResource).toHaveBeenCalledOnce();
  expect(deliverResourceChange).toHaveBeenCalledWith(
    expect.objectContaining({ resourceTitle: resource.title, changeKind: 'resource-added' }),
  );
});

test('emits only effective updates and retains the title for deletion', async () => {
  await PATCH(
    new Request('http://localhost/resources/resource-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: resource.title }),
    }),
    context as never,
  );
  expect(deliverResourceChange).toHaveBeenCalledWith(
    expect.objectContaining({ changeKind: 'resource-updated', resourceTitle: resource.title }),
  );

  deliverResourceChange.mockClear();
  updateResource.mockReturnValue(result({ resource, notification: undefined }));
  await PATCH(
    new Request('http://localhost/resources/resource-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: resource.title }),
    }),
    context as never,
  );
  expect(deliverResourceChange).not.toHaveBeenCalled();

  await DELETE(
    new Request('http://localhost/resources/resource-id', { method: 'DELETE' }),
    context as never,
  );
  expect(deliverResourceChange).toHaveBeenCalledWith(
    expect.objectContaining({
      changeKind: 'resource-removed',
      resourceTitle: resource.title,
      nodeId: 'node-id',
    }),
  );
});

test.each(['storage failure', 'validation failure'] as const)(
  'does not emit when a Resource %s prevents persistence',
  async (failure) => {
    uploadResource.mockReturnValue({
      match: async (
        _onSuccess: (value: typeof resource) => unknown,
        onError: (error: Error) => unknown,
      ) => onError(new Error(failure)),
    });
    await expect(POST(fileUploadRequest(), context as never)).rejects.toThrow(failure);
    expect(deliverResourceChange).not.toHaveBeenCalled();
  },
);
