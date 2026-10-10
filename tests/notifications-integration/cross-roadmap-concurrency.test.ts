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
        await bothRecorded;
      }
      return delivery && (() => delivery((persist) => persist()));
    },
  });
  return { ports: [port(0), port(1)] as const, attempts };
}

type Edit = (course: IntegrationCourse, port: RoadmapChangePort) => Promise<unknown>;

const rename: Edit = (course, port) =>
  teacherEdits(course, port).rename(course.change.nodeId, 'Recursión');
const describe: Edit = (course, port) =>
  teacherEdits(course, port).update(course.change.nodeId, { description: 'Funciones' });
const block: Edit = (course, port) => teacherEdits(course, port).block(course.change.nodeId);
const remove: Edit = async (course, port) =>
  teacherEdits(course, port).remove((await addNode(course, 'Borrador')).id);
const connect: Edit = async (course, port) =>
  teacherEdits(course, port).connect(course.change.nodeId, (await addNode(course, 'Pilas')).id);

test.for([
  { names: 'rename / rename', first: rename, second: rename },
  { names: 'block / description', first: block, second: describe },
  { names: 'delete / connect', first: remove, second: connect },
])(
  'concurrent teaching-staff edits on different Roadmaps do not conflict ($names)',
  async ({ first, second }, { course, otherCourse }) => {
    const { ports, attempts } = overlappingPorts();
    await Promise.all([first(course, ports[0]), second(otherCourse, ports[1])]);
    expect(attempts).toEqual([1, 1]);
  },
);
