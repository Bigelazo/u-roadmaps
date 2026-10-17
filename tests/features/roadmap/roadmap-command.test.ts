// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { randomUUID } from 'node:crypto';
import { beforeAll, expect, onTestFinished, vi } from 'vitest';
import {
  student,
  teacher,
  test,
  type IntegrationCourse,
} from '../../notifications-integration/fixtures';
import { prisma, type Prisma } from '@/shared/server/db';
import { requireUuid } from '@/shared/validation';
import { recordingChangePort } from './support/recording-change-port';
import { roadmapCommand, type AccessScope } from '@/features/roadmap/application/roadmap-command';
import {
  completeNode,
  completeSimulatedNode,
  createRoadmapNodeType,
  createRoadmapResource,
  deleteRoadmapDependency,
  downloadRoadmapResource,
  getNodeTypesForActor,
  getRoadmapNodeResources,
  previewNodeDeletion,
  previewNodeVisibility,
  previewRoadmapDependency,
  previewTeacherBlock,
  readCourseParticipants,
  readRoadmapForParticipant,
  readSimulatedRoadmap,
  resetSimulatedCompletions,
  scheduleTeacherUnlock,
  updateRoadmapNode,
  uploadRoadmapResource,
  type RoadmapChangePort,
} from '@/features/roadmap/server';

beforeAll(databaseSetup, 60_000);

/** Starts the four editor previews, over the course's Node and a second Node. */
async function editorPreviews(course: IntegrationCourse) {
  const nodeId = course.change.nodeId;
  const target = await prisma.roadmapNode.create({
    data: {
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title: 'Colas',
      positionX: 0,
      positionY: 0,
    },
  });
  const editor = teacher(course);
  return (): Promise<unknown>[] => [
    previewNodeDeletion({ ...editor, id: nodeId }),
    previewNodeVisibility({ ...editor, id: nodeId }),
    previewRoadmapDependency({
      ...editor,
      input: { sourceNodeId: nodeId, targetNodeId: target.id },
    }),
    previewTeacherBlock({ ...editor, id: nodeId, operation: 'BLOCK' }),
  ];
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

test('a closed Roadmap answers one code for edit, previews, Completion and Canvas preview', async ({
  course,
}) => {
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  const { port } = recordingChangePort();
  const nodeId = course.change.nodeId;
  const previews = await editorPreviews(course);
  const refusals = await Promise.allSettled([
    updateRoadmapNode({ ...teacher(course), id: nodeId, input: { title: 'Colas' } }, port),
    blockNode('roadmap')({ ...teacher(course), nodeId }, port),
    completeNode({ ...student(course), nodeId }, port),
    completeSimulatedNode({ ...teacher(course), nodeId }, port),
    resetSimulatedCompletions(teacher(course), port),
    ...previews(),
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

test('invalid input is refused before authorisation and before the Roadmap lock', async ({
  course,
}) => {
  const editing = await holdRoadmapLock(course.roadmapId);
  const { port } = recordingChangePort();
  // A student may not edit, so a refusal other than 400 would come from the guard.
  const nonEditor = student(course);
  const nodeId = course.change.nodeId;
  try {
    const outcomes = await Promise.all(
      [
        blockNode('none')({ ...nonEditor, nodeId: 'not-a-node' }, port),
        updateRoadmapNode({ ...nonEditor, id: nodeId, input: {} }, port),
        createRoadmapNodeType({ ...nonEditor, input: { name: '' } }, port),
        createRoadmapResource(
          { ...nonEditor, id: nodeId, input: { title: 'Guía', url: 'sin-url', type: 'LINK' } },
          port,
        ),
        scheduleTeacherUnlock({ ...nonEditor, id: nodeId, unlockOn: '17-10-2026' }, port),
        deleteRoadmapDependency({ ...nonEditor, id: 'not-a-dependency' }, port),
        // A student may complete, so only parsing first keeps this off the lock.
        completeNode({ ...nonEditor, nodeId: 'not-a-node' }, port),
        completeSimulatedNode({ ...nonEditor, nodeId: 'not-a-node' }, port),
      ].map((operation) => settledWithin(operation)),
    );
    for (const outcome of outcomes) expect(outcome).toMatchObject({ error: { status: 400 } });
  } finally {
    await editing.release();
  }
});

test('invalid read ids are refused before authorisation', async ({ course }) => {
  const outsider = { userId: randomUUID(), identifier: course.identifier };
  const refusals = await Promise.allSettled([
    getRoadmapNodeResources({ ...outsider, nodeId: 'not-a-node' }),
    downloadRoadmapResource({ ...outsider, resourceId: 'not-a-resource' }),
  ]);
  for (const refusal of refusals)
    expect(refusal).toMatchObject({ status: 'rejected', reason: { status: 400 } });
});

test('an upload is parsed and authorised before its bytes are saved', async ({ course }) => {
  const { port } = recordingChangePort();
  const upload = async (participant: ReturnType<typeof teacher>, id: string) => {
    const file = new File(['Contenido'], 'guide.txt', { type: 'text/plain' });
    const read = vi.spyOn(file, 'arrayBuffer');
    const outcome = await uploadRoadmapResource({ ...participant, id, file }, port).catch(
      (error: unknown) => error,
    );
    expect(read).not.toHaveBeenCalled();
    return outcome;
  };
  expect(await upload(teacher(course), 'not-a-node')).toMatchObject({ status: 400 });
  expect(await upload(student(course), course.change.nodeId)).toMatchObject({
    status: 403,
    code: 'FORBIDDEN',
  });
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  expect(await upload(teacher(course), course.change.nodeId)).toMatchObject({
    status: 409,
    code: 'ROADMAP_CLOSED',
  });
});

/** Every Roadmap read, each asked by the participant it serves. */
function roadmapReads(course: IntegrationCourse): Promise<unknown>[] {
  const nodeId = course.change.nodeId;
  return [
    readRoadmapForParticipant(student(course)),
    getNodeTypesForActor(student(course)),
    getRoadmapNodeResources({ ...student(course), nodeId }),
    readSimulatedRoadmap(teacher(course)),
    // Without a RUT, Student progress tracking lists the local roster only.
    readCourseParticipants({ id: course.teacherId, rut: null }, course.identifier),
  ];
}

test('reads and editor previews take no Roadmap lock', async ({ course }) => {
  const previews = await editorPreviews(course);
  const editing = await holdRoadmapLock(course.roadmapId);
  try {
    const outcomes = await Promise.all(
      [...roadmapReads(course), ...previews()].map((operation) => settledWithin(operation)),
    );
    for (const outcome of outcomes) expect(outcome).toMatchObject({ value: expect.anything() });
  } finally {
    await editing.release();
  }
});

test('a closed Roadmap stays readable', async ({ course }) => {
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  const outcomes = await Promise.allSettled(roadmapReads(course));
  for (const outcome of outcomes) expect(outcome).toMatchObject({ status: 'fulfilled' });
});

test('an inactive Participation is refused by every Roadmap read', async ({ course }) => {
  const offering = { courseOffering: { roadmap: { id: course.roadmapId } } };
  await prisma.participation.updateMany({ where: offering, data: { isActive: false } });
  const refusals = await Promise.allSettled([
    ...roadmapReads(course),
    downloadRoadmapResource({ ...student(course), resourceId: course.change.nodeId }),
  ]);
  for (const refusal of refusals)
    expect(refusal).toMatchObject({
      status: 'rejected',
      reason: { status: 403, code: 'FORBIDDEN' },
    });
  // Reads only check the stored Participation; they never materialise one.
  expect(await prisma.participation.count({ where: { ...offering, isActive: true } })).toBe(0);
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

test('a failed delivery is logged with context and does not change the response', async ({
  course,
}) => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => logged.mockRestore());
  const failure = new Error('delivery failed');
  const port: RoadmapChangePort = {
    async report() {
      return async () => {
        throw failure;
      };
    },
  };
  const nodeId = course.change.nodeId;
  await expect(blockNode('roadmap')({ ...teacher(course), nodeId }, port)).resolves.toBe(nodeId);
  expect(logged).toHaveBeenCalledWith('Roadmap change delivery failed', {
    roadmapId: course.roadmapId,
    actorId: course.teacherId,
    factKinds: ['node-access'],
    error: failure,
  });
  const node = await prisma.roadmapNode.findUniqueOrThrow({ where: { id: nodeId } });
  expect(node.isTeacherBlocked).toBe(true);
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
