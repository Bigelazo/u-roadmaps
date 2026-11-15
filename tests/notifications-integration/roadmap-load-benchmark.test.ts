import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { afterEach, describe, expect, onTestFinished, vi } from 'vitest';
import { prisma } from '@/shared/server/db';
import { noticesPort } from '@/app/_adapters/notice-change-port';
import { synchronizeCourseOffering } from '@/features/roadmap/server';
import { createMufasaUCampus, forgetAcademicHistory } from '@/integrations/ucampus/server';
import { openNotificationStream } from '@/features/notifications/infrastructure/sse';
import { entryTargetSnapshots } from '@/features/notifications/infrastructure/notice-lifecycle';
import { test, type IntegrationCourse } from './fixtures';
import { integrationClient, integrationDatabaseUrl } from './database';
import { enrollStudents, enterRoadmap } from './roadmap';

const ROUNDS = 5;
const MUFASA_LATENCY_MS = 300;
const output = process.env.ROADMAP_LOAD_BENCHMARK;

function countingQueries() {
  let queries = 0;
  const query = pg.Client.prototype.query;
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    queries += 1;
    return (query as (...values: unknown[]) => unknown).apply(this, args);
  } as typeof query;
  onTestFinished(() => {
    pg.Client.prototype.query = query;
  });
  return () => {
    const taken = queries;
    queries = 0;
    return taken;
  };
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function record(result: object) {
  return appendFile(output!, `${JSON.stringify(result)}\n`);
}

async function outsiders(count: number) {
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

type OpenStream = { userId: string; roadmapEvents: () => number };

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
      return { userId, roadmapEvents: () => text.split('event: roadmap').length - 1 };
    }),
  );
}

async function untilDelivered(streams: readonly OpenStream[], expected: number) {
  const deadline = Date.now() + 10_000;
  while (streams.some((stream) => stream.roadmapEvents() < expected)) {
    if (Date.now() > deadline) throw new Error('Roadmap event was not delivered');
    await delay(10);
  }
  await delay(300);
}

async function denseRoadmap(course: IntegrationCourse) {
  const nodeIds = Array.from({ length: 100 }, () => randomUUID());
  await prisma.roadmapNode.createMany({
    data: nodeIds.map((id, index) => ({
      id,
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title: `Tema ${index}`,
      positionX: (index % 10) * 300,
      positionY: Math.floor(index / 10) * 120,
    })),
  });
  const pairs = new Set<string>();
  for (let index = 0; pairs.size < 150; index += 1) {
    const source = index % 90;
    const target = source + 1 + Math.floor(index / 90);
    pairs.add(`${nodeIds[source]}:${nodeIds[target]}`);
  }
  await prisma.dependency.createMany({
    data: [...pairs].map((pair) => {
      const [sourceNodeId, targetNodeId] = pair.split(':');
      return { sourceNodeId, targetNodeId };
    }),
  });
  await prisma.resource.createMany({
    data: Array.from({ length: 200 }, (_, index) => ({
      roadmapNodeId: nodeIds[index % nodeIds.length],
      title: `Lectura ${index}`,
      url: `https://example.test/lectura-${index}`,
      type: 'LINK' as const,
    })),
  });
  return nodeIds;
}

function mufasaResponses(course: IntegrationCourse) {
  let calls = 0;
  vi.stubEnv('MUFASA_TOKEN', 'benchmark-token');
  vi.stubEnv('MUFASA_BASE_URL', 'http://mufasa.benchmark.test');
  vi.stubGlobal('fetch', async (input: URL) => {
    calls += 1;
    await delay(MUFASA_LATENCY_MS);
    const courses = input.pathname.endsWith('cursos_inscritos')
      ? [
          {
            codigo: course.identifier.courseCode,
            nombre: 'Curso de prueba',
            ano: course.identifier.year,
            periodo: course.identifier.semester,
          },
        ]
      : [];
    return Response.json(courses);
  });
  return () => {
    const taken = calls;
    calls = 0;
    return taken;
  };
}

async function offeringSignals(course: IntegrationCourse) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
    select: { id: true },
  });
  const client = integrationClient(integrationDatabaseUrl());
  let signals = 0;
  client.on('notification', ({ payload }) => {
    const change = JSON.parse(payload ?? '{}') as { courseOfferingId?: string };
    if (change.courseOfferingId === offering.id) signals += 1;
  });
  await client.connect();
  onTestFinished(() => client.end());
  await client.query('LISTEN u_roadmaps_changes');
  return async () => {
    await delay(200);
    const taken = signals;
    signals = 0;
    return taken;
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.skipIf(!output)('roadmap load benchmark', () => {
  test.for([1, 50])(
    'counts queries per Roadmap event with %i open streams',
    { timeout: 120_000 },
    async (connections, { course }) => {
      const members = Math.ceil(connections / 2);
      const memberIds =
        members === 1
          ? [course.studentId]
          : [course.studentId, ...(await enrollStudents(course, members - 1))];
      const outsiderIds = await outsiders(connections - members);
      const streams = await openStreams([...memberIds, ...outsiderIds]);
      const memberStreams = streams.filter(({ userId }) => memberIds.includes(userId));
      const take = countingQueries();
      const perEvent: number[] = [];
      for (let round = 1; round <= ROUNDS; round += 1) {
        await prisma.roadmapNode.update({
          where: { id: course.change.nodeId },
          data: { title: `Recursividad ${round}` },
        });
        take();
        await untilDelivered(memberStreams, round);
        perEvent.push(take());
      }
      const outsiderSet = new Set<string>(outsiderIds);
      expect(
        streams
          .filter(({ userId }) => outsiderSet.has(userId))
          .every((stream) => stream.roadmapEvents() === 0),
      ).toBe(true);
      await record({
        scenario: 'sse-roadmap-event',
        connections,
        members,
        firstEventQueries: perEvent[0],
        laterEventQueries: median(perEvent.slice(1)),
        perEvent,
      });
    },
  );

  test('times entry snapshots for a dense Roadmap', { timeout: 120_000 }, async ({ course }) => {
    const nodeIds = await denseRoadmap(course);
    await enterRoadmap(course.studentId, course.roadmapId);
    const accessible = new Set([course.change.nodeId, ...nodeIds]);
    const durations: number[] = [];
    let snapshots = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      await prisma.$transaction(async (transaction) => {
        const started = performance.now();
        const result = await entryTargetSnapshots(
          transaction,
          course.studentId,
          course.roadmapId,
          [],
          accessible,
        );
        durations.push(performance.now() - started);
        snapshots = result.length;
      });
    }
    expect(snapshots).toBeGreaterThan(accessible.size);
    await record({
      scenario: 'entry-target-snapshots',
      nodes: accessible.size,
      dependencies: 150,
      resources: 200,
      snapshots,
      ms: Math.round(median(durations)),
      durations: durations.map(Math.round),
    });
  });

  test(
    'times two Course offering synchronizations with a slow MUFASA',
    { timeout: 120_000 },
    async ({ course }) => {
      const mufasaCalls = mufasaResponses(course);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: course.studentId } });
      forgetAcademicHistory(user.rut);
      onTestFinished(() => forgetAcademicHistory(user.rut));
      const port = noticesPort((persist) => persist());
      const signals = await offeringSignals(course);
      const take = countingQueries();
      const renders: { ms: number; mufasaCalls: number; queries: number; signals: number }[] = [];
      for (let render = 0; render < 2; render += 1) {
        take();
        const started = performance.now();
        const synchronized = await synchronizeCourseOffering(
          { ...user, ucampus: createMufasaUCampus({ sharedAcademicHistory: true }) },
          course.identifier,
          port,
        );
        const ms = Math.round(performance.now() - started);
        const queries = take();
        renders.push({ ms, mufasaCalls: mufasaCalls(), queries, signals: await signals() });
        expect(synchronized.participation?.role).toBe('STUDENT');
      }
      await record({
        scenario: 'synchronize-course-offering',
        mufasaLatencyMs: MUFASA_LATENCY_MS,
        renders,
      });
    },
  );
});
