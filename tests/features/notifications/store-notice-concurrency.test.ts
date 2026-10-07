import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    participation: { findMany: vi.fn() },
    roadmapNotice: { createMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    noticeDeliveryEffect: { createMany: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ isActive: true, noticeResetAt: null }]),
    nodeLifecycleKnowledge: { findUnique: vi.fn() },
    nodeContentKnowledge: { findUnique: vi.fn() },
    roadmapNode: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/shared/server/db', () => ({ prisma }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (await import('./after-tasks')).scheduleAfter,
}));
import { afterTasks, finishResponse } from './after-tasks';
import { deliverRoadmapAvailability } from '@/features/notifications/server';

vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: 'author-id' }),
}));
vi.mock('@/features/roadmap/server', () => ({
  createRoadmapForActor: () => ({
    match: async (success: (value: unknown) => unknown) =>
      success({
        roadmap: { id: 'roadmap-id' },
        availabilityNotice: notice,
      }),
  }),
}));
import { POST } from '@/app/api/[courseCode]/[year]/[semester]/roadmap/route';

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
  afterTasks.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test('bounds concurrent recipient transactions for a large Course', async () => {
  await deliverRoadmapAvailability(notice);
  await finishResponse();

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
  await finishResponse();

  expect(prisma.$transaction).toHaveBeenCalledTimes(recipients.length);
  const stored = prisma.roadmapNotice.createMany.mock.calls.flatMap(([input]) => input.data);
  expect(stored).toHaveLength(recipients.length - 1);
  expect(warn).toHaveBeenCalledWith('Roadmap availability delivery failed', {
    eventId: 'event-id',
  });
});

test('captures the audience and content before returning without waiting for slow persistence', async () => {
  let release!: () => void;
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  prisma.$transaction.mockImplementation(async (operation) => {
    await slow;
    return operation(prisma);
  });
  const captured = { ...notice, recipients: [...recipients] };
  await deliverRoadmapAvailability(captured);
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(afterTasks).toHaveLength(1);
  const reads = prisma.participation.findMany.mock.calls.length;
  prisma.participation.findMany.mockResolvedValue([{ userId: 'new-student' }]);
  captured.courseName = 'Changed later';
  captured.recipients.length = 0;
  const delivery = finishResponse();
  expect(prisma.$transaction).toHaveBeenCalledTimes(5);
  release();
  await delivery;
  expect(prisma.participation.findMany).toHaveBeenCalledTimes(reads);
  const stored = prisma.roadmapNotice.createMany.mock.calls.flatMap(([input]) => input.data);
  expect(stored.map((row) => row.recipientId)).toEqual(recipients.map(({ userId }) => userId));
  expect(stored[0].data.courseName).toBe('Diseño de software');
});

test('the confirmed Roadmap creation returns HTTP 201 while recipient persistence is blocked', async () => {
  let release!: () => void;
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  prisma.$transaction.mockImplementation(async (operation) => {
    await slow;
    return operation(prisma);
  });
  const response = await POST(new Request('http://localhost/roadmap', { method: 'POST' }), {
    params: Promise.resolve({ courseCode: 'CC3002', year: '2026', semester: '2' }),
  } as never);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ roadmap: { id: 'roadmap-id' } });
  expect(prisma.$transaction).not.toHaveBeenCalled();
  const delivery = finishResponse();
  expect(prisma.$transaction).toHaveBeenCalledTimes(5);
  release();
  await delivery;
  expect(prisma.roadmapNotice.createMany).toHaveBeenCalledTimes(23);
});
