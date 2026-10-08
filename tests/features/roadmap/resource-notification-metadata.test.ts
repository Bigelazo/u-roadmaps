import { beforeEach, expect, test, vi } from 'vitest';

const { prisma, transaction, deleteUploadedFile, saveUploadedFile, validateUploadedFile } =
  vi.hoisted(() => {
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      roadmap: { findUniqueOrThrow: vi.fn() },
      courseOffering: { findUnique: vi.fn() },
      participation: { findUnique: vi.fn(), findMany: vi.fn() },
      dependency: { findMany: vi.fn() },
      nodeContentKnowledge: { createMany: vi.fn(), updateMany: vi.fn() },
      resourceNoticeKnowledge: { createMany: vi.fn() },
      resource: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      roadmapNode: { findFirst: vi.fn(), findMany: vi.fn() },
    };
    return {
      transaction,
      prisma: { $transaction: vi.fn() },
      deleteUploadedFile: vi.fn<(fileKey: string) => Promise<void>>(async () => undefined),
      saveUploadedFile: vi.fn<(fileKey: string, file: File) => Promise<void>>(
        async () => undefined,
      ),
      validateUploadedFile: vi.fn(),
    };
  });

vi.mock('@/shared/server/db', () => ({
  prisma,
  Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
}));
vi.mock('@/features/roadmap/infrastructure/resources/filesystem', () => ({
  deleteUploadedFile,
  saveUploadedFile,
  validateUploadedFile,
}));

import {
  removeRoadmapResource,
  updateRoadmapResource,
  uploadRoadmapResource,
} from '@/features/roadmap/application/resources/commands';

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
const nodeId = '22222222-2222-4222-8222-222222222222';
const resource = {
  id: '11111111-1111-4111-8111-111111111111',
  roadmapNodeId: nodeId,
  title: 'Guía del curso',
  url: 'https://example.test/guide',
  type: 'LINK' as const,
  fileKey: null,
  fileContentType: null,
  updatedAt: new Date('2026-10-06T12:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((operation: (tx: typeof transaction) => unknown) =>
    Promise.resolve(operation(transaction)),
  );
  transaction.courseOffering.findUnique.mockResolvedValue({ roadmap: { id: 'roadmap-id' } });
  transaction.roadmap.findUniqueOrThrow.mockResolvedValue({
    id: 'roadmap-id',
    courseOfferingId: 'offering-id',
    closedAt: null,
  });
  transaction.participation.findUnique.mockResolvedValue({ isActive: true, role: 'TEACHER' });
  transaction.participation.findMany.mockResolvedValue([]);
  transaction.roadmapNode.findMany.mockResolvedValue([]);
  transaction.dependency.findMany.mockResolvedValue([]);
  transaction.resource.findFirst.mockResolvedValue(resource);
  transaction.resource.update.mockResolvedValue({ ...resource, title: 'Updated guide' });
  transaction.resource.delete.mockResolvedValue(resource);
  transaction.roadmapNode.findFirst.mockResolvedValue({ id: nodeId });
  deleteUploadedFile.mockResolvedValue(undefined);
  saveUploadedFile.mockResolvedValue(undefined);
  validateUploadedFile.mockReturnValue(undefined);
});

test('identical Resource updates neither write nor return notification metadata', async () => {
  const result = await updateRoadmapResource({
    userId: 'teacher-id',
    identifier,
    id: resource.id,
    input: { title: resource.title },
  }).match(
    (value) => value,
    (error) => Promise.reject(error),
  );

  expect(transaction.resource.update).not.toHaveBeenCalled();
  expect(result.resource.title).toBe(resource.title);
  expect(result.notification).toBeUndefined();
});

test('effective Resource updates return notification metadata from the committed Resource', async () => {
  const result = await updateRoadmapResource({
    userId: 'teacher-id',
    identifier,
    id: resource.id,
    input: { title: 'Updated guide' },
  }).match(
    (value) => value,
    (error) => Promise.reject(error),
  );

  expect(transaction.resource.update).toHaveBeenCalledWith({
    where: { id: resource.id },
    data: { title: 'Updated guide' },
  });
  expect(result.notification).toEqual({
    nodeId,
    resourceId: resource.id,
    resourceTitle: 'Updated guide',
    previousResource: {
      title: resource.title,
      revision: 'content-v1:cd5489149c42aa94cfe55058902f4a44d24cb4c43b2f6539b1191f10622b9190',
    },
  });
});

test('deletion returns the Resource title and owner Node after preserving them before delete', async () => {
  transaction.resource.findFirst.mockResolvedValueOnce({ ...resource, fileKey: 'stored-file-key' });

  const result = await removeRoadmapResource({
    userId: 'teacher-id',
    identifier,
    id: resource.id,
  }).match(
    (value) => value,
    (error) => Promise.reject(error),
  );

  expect(transaction.resource.delete).toHaveBeenCalledWith({ where: { id: resource.id } });
  expect(deleteUploadedFile).toHaveBeenCalledWith('stored-file-key');
  expect(result).toEqual({
    nodeId,
    resourceId: resource.id,
    resourceTitle: resource.title,
    previousResource: {
      title: resource.title,
      revision: 'content-v1:071cae0addf4fa98ddcc5dc94eeb6ee3133ad34ab3b11f94ab2787406c846e50',
    },
  });
});

test('compensates a stored file when the Resource transaction fails', async () => {
  transaction.resource.create.mockRejectedValueOnce(new Error('database unavailable'));
  const file = new File(['content'], 'guide.pdf', { type: 'application/pdf' });

  const result = await uploadRoadmapResource({
    userId: 'teacher-id',
    identifier,
    id: nodeId,
    file,
  }).match(
    () => Promise.reject(new Error('upload unexpectedly succeeded')),
    (error) => error,
  );

  expect(saveUploadedFile).toHaveBeenCalledWith(expect.any(String), file);
  expect(deleteUploadedFile).toHaveBeenCalledWith(saveUploadedFile.mock.calls[0]?.[0]);
  expect(result).toMatchObject({ code: 'INTERNAL_ERROR' });
});
