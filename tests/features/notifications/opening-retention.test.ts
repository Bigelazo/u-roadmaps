import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { transaction, prisma } = vi.hoisted(() => {
  const transaction = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    noticeAcknowledgement: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    roadmapNotice: { findMany: vi.fn(), updateMany: vi.fn() },
    roadmapNode: { findMany: vi.fn() },
    nodeLifecycleKnowledge: { findMany: vi.fn() },
    noticeKnownValue: { findMany: vi.fn() },
    dependency: { findMany: vi.fn() },
    nodeType: { findMany: vi.fn() },
    routeNoticeKnowledge: { findMany: vi.fn() },
    roadmap: { findUniqueOrThrow: vi.fn() },
  };
  return { transaction, prisma: { ...transaction, $transaction: vi.fn() } };
});
vi.mock('@/shared/server/db', () => ({ prisma }));
import {
  acknowledgeOwnNotices,
  prepareOwnNoticeOpening,
} from '@/features/notifications/infrastructure/own-inbox';

const recipientId = '00000000-0000-4000-8000-000000000001';
const roadmapId = '00000000-0000-4000-8000-000000000002';
const nodeId = '00000000-0000-4000-8000-000000000003';
const operationId = '00000000-0000-4000-8000-000000000004';
const accessibleNodes = async () => new Set([nodeId]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T12:00:00.000Z'));
  transaction.$queryRaw.mockResolvedValue([{ isActive: true, noticeResetAt: null }]);
  prisma.$transaction.mockImplementation(async (operation) => operation(transaction));
  transaction.noticeAcknowledgement.findUnique.mockResolvedValue(null);
  transaction.noticeAcknowledgement.create.mockImplementation(async ({ data }) => data);
  transaction.noticeAcknowledgement.upsert.mockImplementation(async ({ create }) => create);
  transaction.noticeAcknowledgement.deleteMany.mockResolvedValue({ count: 1 });
  transaction.roadmapNode.findMany.mockResolvedValue([]);
  transaction.nodeLifecycleKnowledge.findMany.mockResolvedValue([]);
  transaction.noticeKnownValue.findMany.mockResolvedValue([]);
  transaction.dependency.findMany.mockResolvedValue([]);
  transaction.nodeType.findMany.mockResolvedValue([]);
  transaction.routeNoticeKnowledge.findMany.mockResolvedValue([]);
  transaction.roadmap.findUniqueOrThrow.mockResolvedValue({
    courseOfferingId: 'course-offering',
    courseOffering: { courseCode: 'CC1002', year: 2026, semester: 2 },
  });
  transaction.roadmapNotice.findMany.mockResolvedValue([{ id: 'notice-before', data: {} }]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

test('creating a Roadmap opening prunes only that recipient before the 24-hour cutoff', async () => {
  await prepareOwnNoticeOpening(recipientId, roadmapId, accessibleNodes);
  expect(transaction.noticeAcknowledgement.deleteMany).toHaveBeenCalledWith({
    where: { recipientId, openedAt: { lt: new Date('2026-10-05T12:00:00.000Z') } },
  });
  expect(transaction.noticeAcknowledgement.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      recipientId,
      openedAt: new Date('2026-10-06T12:00:00.000Z'),
      noticeIds: ['notice-before'],
    }),
  });
  expect(transaction.roadmapNotice.updateMany).not.toHaveBeenCalled();
});

test('recognizing a pruned opening fails without recognizing any notices', async () => {
  await expect(
    acknowledgeOwnNotices(recipientId, { roadmapId, operationId }),
  ).rejects.toMatchObject({
    status: 404,
  });
  expect(transaction.roadmapNotice.updateMany).not.toHaveBeenCalled();
});
