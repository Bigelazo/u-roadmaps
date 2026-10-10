import { randomUUID } from 'node:crypto';
import { expect, onTestFinished } from 'vitest';
import { prisma } from '@/shared/server/db';
import { recordRoadmapNotices } from '@/features/notifications/server';
import type { RoadmapChangePort } from '@/features/roadmap/server';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, teacherEdits } from './roadmap';

/**
 * Holds each Roadmap edit open after it recorded its notices, until both edits got there,
 * so the two serializable transactions overlap completely. Counts transaction attempts:
 * a serialization conflict between them shows up as a retried attempt.
 */
function overlappingPorts() {
  let arrived = 0;
  let release!: () => void;
  const bothRecorded = new Promise<void>((resolve) => (release = resolve));
  const attempts = [0, 0];
  const noticeLocks: string[][] = [[], []];
  const port = (index: number): RoadmapChangePort => ({
    async report(transaction, changes) {
      attempts[index] += 1;
      const delivery = await recordRoadmapNotices(transaction, changes);
      if (attempts[index] === 1) {
        noticeLocks[index] = await noticePredicateLocks(transaction);
        if (++arrived === 2) release();
        // Never wait forever: a partner that failed before arriving is retried without the barrier.
        await Promise.race([bothRecorded, new Promise((resolve) => setTimeout(resolve, 3_000))]);
      }
      return delivery && (() => delivery((persist) => persist()));
    },
  });
  return { ports: [port(0), port(1)] as const, attempts, noticeLocks };
}

/**
 * The transaction's predicate (SIRead) locks on notice-table rows or pages, and any on a
 * whole notice table or index. Row locks grow with the recipients until PostgreSQL
 * promotes them to one lock on the whole table, which ties the edit to every other
 * Roadmap's writes. Index ranges an exact lookup or delete reads may stay page-locked.
 */
async function noticePredicateLocks(transaction: Parameters<RoadmapChangePort['report']>[0]) {
  const [{ pid }] = await transaction.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
  const rows = await prisma.$queryRaw<{ lock: string }[]>`
    SELECT c.relname || ':' || l.locktype AS lock
    FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
    WHERE l.pid = ${pid} AND l.mode = 'SIReadLock'
      AND (c.relname IN ('NoticeKnownValue', 'RoadmapNotice')
        OR (c.relname LIKE 'NoticeKnownValue%' OR c.relname LIKE 'RoadmapNotice%') AND l.locktype = 'relation')`;
  return rows.map(({ lock }) => lock);
}

/** More students than PostgreSQL's 32 predicate locks per relation before promotion. */
const MANY_STUDENTS = 48;

async function enrollStudents(course: IntegrationCourse, count: number) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
  });
  const ids = Array.from({ length: count }, () => randomUUID());
  onTestFinished(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  await prisma.user.createMany({
    data: ids.map((id) => ({
      id,
      name: 'Estudiante',
      institutionalEmail: `${id}@notifications.u-roadmaps.test`,
      rut: id.slice(0, 20),
    })),
  });
  await prisma.participation.createMany({
    data: ids.map((userId) => ({ userId, courseOfferingId: offering.id, role: 'STUDENT' })),
  });
}

/** A Node every student already knows: a delivered rename recorded their Known values. */
async function knownNode(course: IntegrationCourse) {
  const node = await addNode(course, 'Recursividad');
  await teacherEdits(course).rename(node.id, 'Recursión');
  return node.id;
}

/** One edit on a fresh Node of the course's Roadmap, so a round can be repeated. */
type Edit = (course: IntegrationCourse, port: RoadmapChangePort) => Promise<unknown>;

const fresh = (course: IntegrationCourse) => addNode(course, 'Recursividad');
const rename: Edit = async (course, port) =>
  teacherEdits(course, port).rename((await fresh(course)).id, 'Recursión');
const describe: Edit = async (course, port) =>
  teacherEdits(course, port).update((await fresh(course)).id, { description: 'Funciones' });
const block: Edit = async (course, port) =>
  teacherEdits(course, port).block((await fresh(course)).id);
const remove: Edit = async (course, port) =>
  teacherEdits(course, port).remove((await fresh(course)).id);
const connect: Edit = async (course, port) =>
  teacherEdits(course, port).connect(course.change.nodeId, (await fresh(course)).id);

// Before #220 every round conflicted: whole tables were read under relation-level
// predicate locks. Heap and index pages shared by tiny test tables can still, rarely,
// tie a round to an unrelated test's transaction, so one repeat round is allowed.
const ROUNDS = 2;

test.for([
  { names: 'rename / rename', first: rename, second: rename },
  { names: 'block / description', first: block, second: describe },
  { names: 'delete / connect', first: remove, second: connect },
])(
  'concurrent teaching-staff edits on different Roadmaps do not conflict ($names)',
  async ({ first, second }, { course, otherCourse }) => {
    let attempts: number[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const overlapping = overlappingPorts();
      await Promise.all([
        first(course, overlapping.ports[0]),
        second(otherCourse, overlapping.ports[1]),
      ]);
      attempts = overlapping.attempts;
      if (attempts.every((count) => count === 1)) break;
    }
    expect(attempts).toEqual([1, 1]);
  },
);

test.for([
  {
    names: 'block / block',
    edit: (course: IntegrationCourse, port: RoadmapChangePort, nodeId: string) =>
      teacherEdits(course, port).block(nodeId),
  },
  {
    names: 'delete / delete',
    edit: (course: IntegrationCourse, port: RoadmapChangePort, nodeId: string) =>
      teacherEdits(course, port).remove(nodeId),
  },
])(
  'edits reaching more than 32 recipients lock no notice rows or whole notice tables ($names)',
  async ({ edit }, { course, otherCourse }) => {
    await Promise.all([course, otherCourse].map((each) => enrollStudents(each, MANY_STUDENTS)));
    // A second known Node per Roadmap: its Known values must stay unread by the edit.
    const [nodeId, otherNodeId] = await Promise.all(
      [course, otherCourse].map(
        async (each) => (await Promise.all([knownNode(each), knownNode(each)]))[0],
      ),
    );
    const overlapping = overlappingPorts();
    await Promise.all([
      edit(course, overlapping.ports[0], nodeId),
      edit(otherCourse, overlapping.ports[1], otherNodeId),
    ]);
    expect(overlapping.noticeLocks).toEqual([[], []]);
    // Attempts are not asserted here: both Roadmaps' few Nodes share a RoadmapNode heap
    // page in the test database, and each edit reads its Nodes and writes one of them.
  },
);
