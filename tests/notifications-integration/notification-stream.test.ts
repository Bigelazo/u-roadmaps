import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { expect, onTestFinished } from 'vitest';
import { prisma } from '@/shared/server/db';
import { openNotificationStream } from '@/features/notifications/infrastructure/sse';
import { test, type IntegrationCourse } from './fixtures';

type RoadmapSignal = { courseOfferingId: string; userId: string; accessLost?: boolean };
type OpenStream = { userId: string; signals: () => RoadmapSignal[] };

async function offeringOf(course: IntegrationCourse) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
    select: { id: true },
  });
  return offering.id;
}

function mentions(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some((item) => mentions(item, id));
  if (value && typeof value === 'object')
    return mentions((value as { values?: unknown }).values, id);
  return false;
}

function countingLookups(courseOfferingId: string) {
  let lookups = 0;
  const query = pg.Client.prototype.query;
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    if (mentions(args, courseOfferingId)) lookups += 1;
    return (query as (...values: unknown[]) => unknown).apply(this, args);
  } as typeof query;
  onTestFinished(() => {
    pg.Client.prototype.query = query;
  });
  return () => {
    const taken = lookups;
    lookups = 0;
    return taken;
  };
}

async function visitors(count: number) {
  const ids = Array.from({ length: count }, () => randomUUID());
  onTestFinished(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  await prisma.user.createMany({
    data: ids.map((id) => ({
      id,
      name: 'Visitante',
      institutionalEmail: `${id}@notifications.u-roadmaps.test`,
      rut: id.slice(0, 20),
    })),
  });
  return ids;
}

async function openStreams(userIds: readonly string[]) {
  const abort = new AbortController();
  onTestFinished(() => abort.abort());
  return Promise.all(
    userIds.map(async (userId): Promise<OpenStream> => {
      const response = await openNotificationStream(userId, abort.signal);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      const ready = Promise.withResolvers<void>();
      void (async () => {
        for (;;) {
          const { done, value } = await reader
            .read()
            .catch(() => ({ done: true, value: undefined }));
          if (done) return;
          text += decoder.decode(value);
          if (text.includes('event: ready')) ready.resolve();
        }
      })();
      await ready.promise;
      return {
        userId,
        signals: () =>
          [...text.matchAll(/event: roadmap\ndata: (.*)\n\n/g)].map(
            ([, data]) => JSON.parse(data) as RoadmapSignal,
          ),
      };
    }),
  );
}

async function settled(streams: readonly OpenStream[], courseOfferingId: string, count: number) {
  const deadline = Date.now() + 10_000;
  const received = (stream: OpenStream) =>
    stream.signals().filter((signal) => signal.courseOfferingId === courseOfferingId).length;
  while (streams.some((stream) => received(stream) < count)) {
    if (Date.now() > deadline) throw new Error('Roadmap signal was not delivered');
    await delay(10);
  }
  await delay(300);
}

function from(stream: OpenStream, courseOfferingId: string) {
  return stream.signals().filter((signal) => signal.courseOfferingId === courseOfferingId);
}

test('a Roadmap change looks up membership once however many streams are open', async ({
  course,
}) => {
  const courseOfferingId = await offeringOf(course);
  const outsiderIds = await visitors(6);
  const streams = await openStreams([course.studentId, course.classmateId, ...outsiderIds]);
  const members = streams.slice(0, 2);
  const outsiders = streams.slice(2);
  const lookups = countingLookups(courseOfferingId);
  const perChange: number[] = [];
  for (let round = 1; round <= 3; round += 1) {
    await prisma.roadmapNode.update({
      where: { id: course.change.nodeId },
      data: { title: `Recursividad ${round}` },
    });
    await settled(members, courseOfferingId, round);
    perChange.push(lookups());
  }
  expect(perChange).toEqual([1, 1, 1]);
  expect(outsiders.map((stream) => from(stream, courseOfferingId))).toEqual(
    outsiderIds.map(() => []),
  );
  expect(from(members[0], courseOfferingId)).toEqual([
    expect.objectContaining({ courseOfferingId, userId: course.studentId }),
    expect.objectContaining({ courseOfferingId, userId: course.studentId }),
    expect.objectContaining({ courseOfferingId, userId: course.studentId }),
  ]);
});

test('a newly enrolled user receives Roadmap changes after their Participation change', async ({
  course,
}) => {
  const courseOfferingId = await offeringOf(course);
  const [newcomerId] = await visitors(1);
  const [newcomer, student] = await openStreams([newcomerId, course.studentId]);
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { title: 'Antes' },
  });
  await settled([student], courseOfferingId, 1);
  expect(from(newcomer, courseOfferingId)).toEqual([]);

  await prisma.participation.create({
    data: { userId: newcomerId, courseOfferingId, role: 'STUDENT' },
  });
  await settled([newcomer], courseOfferingId, 1);
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { title: 'Después' },
  });
  await settled([newcomer, student], courseOfferingId, 2);

  expect(from(newcomer, courseOfferingId)).toEqual([
    expect.objectContaining({ courseOfferingId, userId: newcomerId }),
    expect.objectContaining({ courseOfferingId, userId: newcomerId }),
  ]);
  expect(from(newcomer, courseOfferingId).some((signal) => 'accessLost' in signal)).toBe(false);
  expect(from(student, courseOfferingId)).toHaveLength(2);
});

test('only the deactivated participant is told they lost access', async ({ course }) => {
  const courseOfferingId = await offeringOf(course);
  const [student, classmate] = await openStreams([course.studentId, course.classmateId]);
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await settled([student], courseOfferingId, 1);
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { title: 'Sin acceso' },
  });
  await settled([classmate], courseOfferingId, 1);
  await settled([student], courseOfferingId, 2);

  expect(from(student, courseOfferingId)).toEqual([
    expect.objectContaining({ courseOfferingId, userId: course.studentId, accessLost: true }),
    expect.objectContaining({ courseOfferingId, userId: course.studentId }),
  ]);
  expect(from(student, courseOfferingId)[1]).not.toHaveProperty('accessLost');
  expect(from(classmate, courseOfferingId)).toEqual([
    expect.objectContaining({ courseOfferingId, userId: course.classmateId }),
  ]);
});
