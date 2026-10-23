vi.mock('@/app/_adapters/roadmap-changes', () => ({ roadmapChangePort: {} }));
import { beforeEach, expect, test, vi } from 'vitest';

const { changeTeacherBlock, previewTeacherBlock } = vi.hoisted(() => ({
  changeTeacherBlock: vi.fn(),
  previewTeacherBlock: vi.fn(),
}));

vi.mock('@/shared/server/db', () => ({ Prisma: {} }));
vi.mock('@/shared/errors/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/errors/server')>()),
  applicationResult: (operation: () => Promise<Response>) => ({
    match: (onSuccess: (response: Response) => Response) => operation().then(onSuccess),
  }),
}));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'teacher-id' }),
}));
vi.mock('@/app/_adapters/roadmap', () => ({
  requireCourseOfferingIdentifier: () => ({ courseCode: 'CC3002', year: 2026, semester: 2 }),
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

test('a failed confirmed action returns its error', async () => {
  const error = new Error('TEACHER_BLOCK_PREVIEW_STALE');
  changeTeacherBlock.mockRejectedValue(error);

  await expect(
    DELETE(
      new Request('http://localhost/teacher-block', {
        method: 'DELETE',
        headers: { 'x-teacher-block-preview': 'stale-version' },
      }),
      context as never,
    ),
  ).rejects.toThrow('TEACHER_BLOCK_PREVIEW_STALE');
});
