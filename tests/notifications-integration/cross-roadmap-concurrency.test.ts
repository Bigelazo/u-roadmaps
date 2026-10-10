import { expect } from 'vitest';
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
  const port = (index: number): RoadmapChangePort => ({
    async report(transaction, changes) {
      attempts[index] += 1;
      const delivery = await recordRoadmapNotices(transaction, changes);
      if (attempts[index] === 1) {
        if (++arrived === 2) release();
        // Never wait forever: a partner that failed before arriving is retried without the barrier.
        await Promise.race([bothRecorded, new Promise((resolve) => setTimeout(resolve, 3_000))]);
      }
      return delivery && (() => delivery((persist) => persist()));
    },
  });
  return { ports: [port(0), port(1)] as const, attempts };
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
