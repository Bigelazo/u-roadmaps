// @vitest-environment node
vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApplicationError } from '@/shared/errors/types';

const { createResource, uploadResource, updateResource, replaceResourceFile, removeResource } =
  vi.hoisted(() => ({
    createResource: vi.fn(),
    uploadResource: vi.fn(),
    updateResource: vi.fn(),
    replaceResourceFile: vi.fn(),
    removeResource: vi.fn(),
  }));

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/features/roadmap/server', () => ({
  createRoadmapResource: createResource,
  uploadRoadmapResource: uploadResource,
  updateRoadmapResource: updateResource,
  replaceRoadmapResourceFile: replaceResourceFile,
  removeRoadmapResource: removeResource,
  getRoadmapNodeResources: vi.fn(),
}));

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

function fileUploadRequest() {
  const body = new FormData();
  body.set(
    'file',
    new File(['%PDF-1.7 course guide'], 'Guía del curso.pdf', { type: 'application/pdf' }),
  );
  return new Request('http://localhost/resources', { method: 'POST', body });
}

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.clearAllMocks();
  createResource.mockResolvedValue(resource);
  uploadResource.mockResolvedValue(resource);
  updateResource.mockResolvedValue({ resource });
  replaceResourceFile.mockResolvedValue({ resource });
  removeResource.mockResolvedValue({});
});

test.each(['LINK'] as const)('returns a confirmed %s Resource addition', async (type) => {
  const response = await POST(
    new Request('http://localhost/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: resource.title, url: 'https://example.test/resource', type }),
    }),
    context as never,
  );

  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual({ resource });
});

test('returns a confirmed uploaded Resource', async () => {
  const response = await POST(fileUploadRequest(), context as never);

  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual({ resource });
  const file = uploadResource.mock.calls[0][0].file as File;
  expect(file).toBeInstanceOf(File);
  expect(file.name).toBe('Guía del curso.pdf');
  expect(file.type).toBe('application/pdf');
  await expect(file.text()).resolves.toBe('%PDF-1.7 course guide');
  expect(uploadResource).toHaveBeenCalledWith(
    {
      userId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      id: 'node-id',
      file,
    },
    expect.any(Object),
  );
});

test('returns the updated Resource and an empty deletion response', async () => {
  const updated = await PATCH(
    new Request('http://localhost/resources/resource-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: resource.title }),
    }),
    context as never,
  );
  expect(await updated.json()).toEqual({ resource });
  const deleted = await DELETE(
    new Request('http://localhost/resources/resource-id', { method: 'DELETE' }),
    context as never,
  );
  expect(deleted.status).toBe(204);
  expect(await deleted.text()).toBe('');
});

test('replaces a Resource file from a multipart edit with its title', async () => {
  const body = new FormData();
  body.set('title', 'Guía revisada.pdf');
  body.set('file', new File(['%PDF-1.7 revised'], 'revisada.pdf', { type: 'application/pdf' }));
  const response = await PATCH(
    new Request('http://localhost/resources/resource-id', { method: 'PATCH', body }),
    context as never,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ resource });
  expect(updateResource).not.toHaveBeenCalled();
  const file = replaceResourceFile.mock.calls[0][0].file as File;
  await expect(file.text()).resolves.toBe('%PDF-1.7 revised');
  expect(replaceResourceFile).toHaveBeenCalledWith(
    {
      userId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      id: 'resource-id',
      title: 'Guía revisada.pdf',
      file,
    },
    expect.any(Object),
  );
});

test.each([
  {
    name: 'typed invalid file',
    failure: new ApplicationError(400, 'INVALID_FILE', 'El archivo no es válido.'),
    status: 400,
    error: { code: 'INVALID_FILE', message: 'El archivo no es válido.' },
  },
  {
    name: 'unexpected storage failure',
    failure: new Error('SECRET storage path'),
    status: 500,
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
  },
])('serializes a $name after real multipart parsing', async ({ failure, status, error }) => {
  if (!(failure instanceof ApplicationError))
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  uploadResource.mockRejectedValue(failure);
  const response = await POST(fileUploadRequest(), context);
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
});
