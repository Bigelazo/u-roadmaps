// @vitest-environment node
vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApplicationError } from '@/shared/errors/types';

const { changeTeacherBlock, previewTeacherBlock } = vi.hoisted(() => ({
  changeTeacherBlock: vi.fn(),
  previewTeacherBlock: vi.fn(),
}));

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/features/roadmap/server', () => ({ changeTeacherBlock, previewTeacherBlock }));

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from '@/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block/route';

const context = {
  params: Promise.resolve({
    courseCode: 'CC3002',
    year: '2026',
    semester: '2',
    nodeId: 'selected-node-id',
  }),
};

const preview = { mode: 'BRANCH', nodes: [], version: 'preview-version' };

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.clearAllMocks();
  changeTeacherBlock.mockResolvedValue(preview);
  previewTeacherBlock.mockResolvedValue(preview);
});

test.each([
  ['POST', POST, 'BLOCK'],
  ['DELETE', DELETE, 'UNBLOCK'],
  ['PATCH', PATCH, 'BRANCH_UNLOCK'],
] as const)(
  '%s returns the plain result from the committed teacher action',
  async (method, handler, operation) => {
    const response = await handler(
      new Request('http://localhost/teacher-block', {
        method,
        headers: { 'x-teacher-block-preview': 'preview-version' },
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(changeTeacherBlock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teacher-id', id: 'selected-node-id', operation }),
      expect.any(Object),
    );
    expect(await response.json()).toEqual({
      mode: 'BRANCH',
      nodes: [],
      version: 'preview-version',
    });
  },
);

test('a preview returns its result without a mutation', async () => {
  const response = await GET(
    new Request('http://localhost/teacher-block?operation=BRANCH_UNLOCK'),
    context as never,
  );

  expect(response.status).toBe(200);
  expect(previewTeacherBlock).toHaveBeenCalledOnce();
  expect(changeTeacherBlock).not.toHaveBeenCalled();
});

test.each([
  {
    name: 'stale confirmed action',
    failure: new ApplicationError(
      409,
      'TEACHER_BLOCK_PREVIEW_STALE',
      'La previsualización cambió.',
    ),
    status: 409,
    error: { code: 'TEACHER_BLOCK_PREVIEW_STALE', message: 'La previsualización cambió.' },
  },
  {
    name: 'unexpected mutation failure',
    failure: new Error('SECRET SQL'),
    status: 500,
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
  },
])('serializes a $name', async ({ failure, status, error }) => {
  if (!(failure instanceof ApplicationError))
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  changeTeacherBlock.mockRejectedValue(failure);
  const response = await DELETE(
    new Request('http://localhost/teacher-block', {
      method: 'DELETE',
      headers: { 'x-teacher-block-preview': 'stale-version' },
    }),
    context,
  );
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error });
});
