import { beforeEach, expect, test, vi } from 'vitest';

const { changeTeacherBlock, previewTeacherBlock, deliverRoadmapNodeNotifications } = vi.hoisted(
  () => ({
    changeTeacherBlock: vi.fn(),
    previewTeacherBlock: vi.fn(),
    deliverRoadmapNodeNotifications: vi.fn(async () => undefined),
  }),
);

vi.mock('@/app/_adapters/http', () => ({
  handleApplicationResult: (operation: () => Promise<Response>) => operation(),
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
vi.mock('@/features/roadmap/server', () => ({ changeTeacherBlock, previewTeacherBlock }));
vi.mock('@/app/_adapters/roadmap-node-notifications', () => ({ deliverRoadmapNodeNotifications }));

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from '@/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block/route';

const notifications = [
  {
    nodeId: 'blocked-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-blocked' as const,
    nodeTitle: 'Nodo bloqueado',
    nodeTypeName: 'Contenido',
    targetKind: 'roadmap' as const,
    recipientIds: ['student-id'],
  },
  {
    nodeId: 'available-node-id',
    roadmapId: 'roadmap-id',
    changeKind: 'node-available' as const,
    nodeTitle: 'Nodo disponible',
    nodeTypeName: 'Contenido',
    targetKind: 'node' as const,
    recipientIds: ['other-student-id'],
  },
];

const context = {
  params: Promise.resolve({
    courseCode: 'CC3002',
    year: '2026',
    semester: '2',
    nodeId: 'selected-node-id',
  }),
};

function result<T>(value: T) {
  return { match: async (onSuccess: (value: T) => unknown) => onSuccess(value) };
}

function mutationResult() {
  return result({ mode: 'BRANCH', nodes: [], version: 'preview-version', notifications });
}

beforeEach(() => {
  vi.clearAllMocks();
  changeTeacherBlock.mockReturnValue(mutationResult());
  previewTeacherBlock.mockReturnValue(
    result({ mode: 'BRANCH', nodes: [], version: 'preview-version' }),
  );
});

test.each([
  ['POST', POST, 'BLOCK'],
  ['DELETE', DELETE, 'UNBLOCK'],
  ['PATCH', PATCH, 'BRANCH_UNLOCK'],
] as const)(
  '%s delivers each notice from the committed teacher action',
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
    );
    expect(deliverRoadmapNodeNotifications).toHaveBeenCalledExactlyOnceWith({
      actorId: 'teacher-id',
      identifier: { courseCode: 'CC3002', year: 2026, semester: 2 },
      notifications,
    });
    expect(await response.json()).toEqual({
      mode: 'BRANCH',
      nodes: [],
      version: 'preview-version',
    });
  },
);

test('a preview never delivers access notices', async () => {
  const response = await GET(
    new Request('http://localhost/teacher-block?operation=BRANCH_UNLOCK'),
    context as never,
  );

  expect(response.status).toBe(200);
  expect(previewTeacherBlock).toHaveBeenCalledOnce();
  expect(changeTeacherBlock).not.toHaveBeenCalled();
  expect(deliverRoadmapNodeNotifications).not.toHaveBeenCalled();
});

test('a failed confirmed action does not deliver access notices', async () => {
  const error = new Error('TEACHER_BLOCK_PREVIEW_STALE');
  changeTeacherBlock.mockReturnValue({
    match: async (_onSuccess: (value: unknown) => unknown, onError: (error: Error) => unknown) =>
      onError(error),
  });

  await expect(
    DELETE(
      new Request('http://localhost/teacher-block', {
        method: 'DELETE',
        headers: { 'x-teacher-block-preview': 'stale-version' },
      }),
      context as never,
    ),
  ).rejects.toThrow('TEACHER_BLOCK_PREVIEW_STALE');
  expect(deliverRoadmapNodeNotifications).not.toHaveBeenCalled();
});
