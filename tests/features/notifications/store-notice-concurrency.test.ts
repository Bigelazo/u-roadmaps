import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    participation: { findMany: vi.fn() },
    roadmapNotice: { createMany: vi.fn() },
    noticeDeliveryEffect: { createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
import { deliverRoadmapAvailability } from '@/features/notifications/server';

const recipients = Array.from({ length: 23 }, (_, index) => ({
  userId: `student-${index}`,
  name: `Estudiante ${index}`,
}));
const notice = {
  eventId: 'event-id',
  roadmapId: 'roadmap-id',
  courseOfferingId: 'offering-id',
  courseCode: 'CC3002',
  year: 2026,
  semester: 2,
  courseName: 'Diseño de software',
  actorId: 'author-id',
  actorName: 'Docente autora',
  occurredAt: new Date('2026-10-04T12:00:00.000Z'),
  recipients,
};

let active = 0;
let peak = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  delete (globalThis as typeof globalThis & { ownNoticeGrouper?: unknown }).ownNoticeGrouper;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  active = 0;
  peak = 0;
  prisma.participation.findMany.mockImplementation(
    async (query: { where: { userId: { in: string[] } } }) =>
      query.where.userId.in.map((userId) => ({ userId })),
  );
  prisma.noticeDeliveryEffect.createMany.mockResolvedValue({ count: 1 });
  prisma.roadmapNotice.createMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation(async (operation) => {
    active += 1;
    peak = Math.max(peak, active);
    try {
      await Promise.resolve();
      return await operation(prisma);
    } finally {
      active -= 1;
    }
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test('bounds concurrent recipient transactions for a large Course', async () => {
  await deliverRoadmapAvailability(notice);

  expect(prisma.$transaction).toHaveBeenCalledTimes(recipients.length);
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(5);
});

test('attempts every recipient before reporting a delivery failure', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  prisma.noticeDeliveryEffect.createMany.mockImplementation(
    async ({ data }: { data: { recipientId: string }[] }) => {
      if (data[0].recipientId === 'student-1') throw new Error('pool timeout');
      return { count: 1 };
    },
  );

  await deliverRoadmapAvailability(notice);

  expect(prisma.$transaction).toHaveBeenCalledTimes(recipients.length);
  const stored = prisma.roadmapNotice.createMany.mock.calls.flatMap(([input]) => input.data);
  expect(stored).toHaveLength(recipients.length - 1);
  expect(warn).toHaveBeenCalledWith('Roadmap availability delivery failed', {
    eventId: 'event-id',
  });
});
