// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { beforeAll, expect } from 'vitest';
import { test, type IntegrationCourse } from '../../notifications-integration/fixtures';
import { prisma, type Prisma } from '@/shared/server/db';
import { requireUuid } from '@/shared/validation';
import { recordingChangePort } from './support/recording-change-port';
import { roadmapCommand, type AccessScope } from '@/features/roadmap/application/roadmap-command';
import {
  completeNode,
  completeSimulatedNode,
  readRoadmapForParticipant,
  resetSimulatedCompletions,
  updateRoadmapNode,
  type RoadmapChangePort,
} from '@/features/roadmap/server';

beforeAll(databaseSetup, 60_000);

function teacher(course: IntegrationCourse) {
  return { userId: course.teacherId, identifier: course.identifier };
}

function student(course: IntegrationCourse) {
  return { userId: course.studentId, identifier: course.identifier };
}

/** Holds the Roadmap row FOR UPDATE in another transaction, as an editor or closure would. */
async function holdRoadmapLock(
  roadmapId: string,
  beforeRelease: (tx: Prisma.TransactionClient) => Promise<unknown> = async () => undefined,
) {
  let locked!: (pid: number) => void;
  const lockedBy = new Promise<number>((resolve) => (locked = resolve));
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const holder = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmapId}::uuid FOR UPDATE`;
      const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      locked(pid);
      await released;
      await beforeRelease(tx);
    },
    { timeout: 20_000 },
  );
  const pid = await lockedBy;
  return {
    /** Resolves once another backend waits for this lock. */
    async blocksAnother() {
      for (;;) {
        const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
        if (waiting > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    },
    async release() {
      release();
      await holder;
    },
  };
}

/** `operation`'s outcome, or 'blocked' when it is still waiting after `ms`. */
function settledWithin<T>(operation: Promise<T>, ms = 2_000) {
  return Promise.race([
    operation.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    ),
    new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), ms)),
  ]);
}

/**
 * Makes the transaction's COMMIT fail with `sqlstate`: a deferred constraint trigger on a
 * temporary table raises it while committing, after everything the transaction ran.
 */
async function failCommit(tx: Prisma.TransactionClient, sqlstate: string) {
  await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.fail_commit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'commit failed' USING ERRCODE = '${sqlstate}'; END $$`);
  await tx.$executeRawUnsafe(`CREATE TEMP TABLE commit_guard (id int) ON COMMIT DROP`);
  await tx.$executeRawUnsafe(`CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON commit_guard
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_commit()`);
  await tx.$executeRawUnsafe(`INSERT INTO commit_guard VALUES (1)`);
}

/** A test command that blocks a Node, which changes its access for every participant. */
const blockNode = (access: AccessScope) =>
  roadmapCommand({
    capability: 'edit',
    parse: ({ nodeId }: { nodeId: string }) => ({ nodeId: requireUuid(nodeId, 'nodeId') }),
    access,
    run: async ({ tx, input }) => {
      await tx.roadmapNode.update({
        where: { id: input.nodeId },
        data: { isTeacherBlocked: true },
      });
      return { result: input.nodeId, facts: [] };
    },
  });

test('a declared access scope reports access facts, and none reports none', async ({ course }) => {
  const recording = recordingChangePort();
  const request = { ...teacher(course), nodeId: course.change.nodeId };
  await blockNode('roadmap')(request, recording.port);
  const recipients = recording
    .facts()
    .map((fact) => fact.kind === 'node-access' && fact.recipientId);
  expect(recipients).toEqual(expect.arrayContaining([course.studentId, course.classmateId]));

  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { isTeacherBlocked: false },
  });
  recording.changes.length = 0;
  await blockNode('none')(request, recording.port);
  expect(recording.changes).toEqual([]);
});

test('a closed Roadmap answers one code for edit, Completion and Canvas preview', async ({
  course,
}) => {
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  const { port } = recordingChangePort();
  const nodeId = course.change.nodeId;
  const refusals = await Promise.allSettled([
    updateRoadmapNode({ ...teacher(course), id: nodeId, input: { title: 'Colas' } }, port),
    blockNode('roadmap')({ ...teacher(course), nodeId }, port),
    completeNode({ ...student(course), nodeId }, port),
    completeSimulatedNode({ ...teacher(course), nodeId }, port),
    resetSimulatedCompletions(teacher(course), port),
  ]);
  for (const refusal of refusals)
    expect(refusal).toMatchObject({
      status: 'rejected',
      reason: { status: 409, code: 'ROADMAP_CLOSED' },
    });
});

test('a Completion racing with the Roadmap closure is refused as a closed Roadmap', async ({
  course,
}) => {
  const closure = await holdRoadmapLock(course.roadmapId, (tx) =>
    tx.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } }),
  );
  const completion = completeNode(
    { ...student(course), nodeId: course.change.nodeId },
    recordingChangePort().port,
  );
  await closure.blocksAnother();
  await closure.release();
  await expect(completion).rejects.toMatchObject({ status: 409, code: 'ROADMAP_CLOSED' });
});

test('invalid input is refused before the Roadmap lock', async ({ course }) => {
  const editing = await holdRoadmapLock(course.roadmapId);
  try {
    const outcome = await settledWithin(
      blockNode('none')({ ...teacher(course), nodeId: 'not-a-node' }, recordingChangePort().port),
    );
    expect(outcome).toMatchObject({ error: { status: 400, code: 'INVALID_REQUEST' } });
  } finally {
    await editing.release();
  }
});

test('a participant read takes no Roadmap lock', async ({ course }) => {
  const editing = await holdRoadmapLock(course.roadmapId);
  try {
    const outcome = await settledWithin(readRoadmapForParticipant(student(course)));
    expect(outcome).toMatchObject({ value: { nodes: expect.any(Array) } });
  } finally {
    await editing.release();
  }
});

test('delivery runs only after commit', async ({ course }) => {
  const delivered: boolean[] = [];
  const port: RoadmapChangePort = {
    async report() {
      return async () => {
        const node = await prisma.roadmapNode.findUniqueOrThrow({
          where: { id: course.change.nodeId },
        });
        delivered.push(node.isTeacherBlocked);
      };
    },
  };
  await blockNode('roadmap')({ ...teacher(course), nodeId: course.change.nodeId }, port);
  expect(delivered).toEqual([true]);
});

test('a failed commit discards delivery', async ({ course }) => {
  const delivered: string[] = [];
  const port: RoadmapChangePort = {
    async report(tx) {
      await failCommit(tx, 'P0001');
      return () => {
        delivered.push('delivered');
      };
    },
  };
  await expect(
    blockNode('roadmap')({ ...teacher(course), nodeId: course.change.nodeId }, port),
  ).rejects.toThrow();
  expect(delivered).toEqual([]);
  const node = await prisma.roadmapNode.findUniqueOrThrow({ where: { id: course.change.nodeId } });
  expect(node.isTeacherBlocked).toBe(false);
});

test('only the committed retry attempt delivers', async ({ course }) => {
  let attempts = 0;
  const delivered: number[] = [];
  const port: RoadmapChangePort = {
    async report(tx) {
      const attempt = (attempts += 1);
      if (attempt === 1) await failCommit(tx, '40001');
      return () => {
        delivered.push(attempt);
      };
    },
  };
  await blockNode('roadmap')({ ...teacher(course), nodeId: course.change.nodeId }, port);
  expect(delivered).toEqual([2]);
});
