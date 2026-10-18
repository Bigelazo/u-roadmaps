import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, addType, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';
import { countOwnNodeChangeTargets, countOwnNotices } from '@/features/notifications/server';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];
type Edits = ReturnType<typeof teacherEdits>;
type NodeState = 'visible' | 'hidden' | 'Teacher-blocked';

const noticeTarget = ({ data }: Notice) => (data as { noticeTarget?: string }).noticeTarget;

const STATE: Record<NodeState, { isVisible?: boolean; isTeacherBlocked?: boolean }> = {
  visible: {},
  hidden: { isVisible: false },
  'Teacher-blocked': { isTeacherBlocked: true },
};

/** Puts a Node in the state through a real edit, as a colleague would. */
function applyState(edits: Edits, nodeId: string, state: NodeState) {
  if (state === 'hidden') return edits.update(nodeId, { isVisible: false });
  if (state === 'Teacher-blocked') return edits.block(nodeId);
}

/**
 * Each Node change, made by the course teacher on a Node in the given state, and the
 * Notice target that tells it. Creation reaches its state after the Node is created.
 */
const CHANGES: Record<
  string,
  {
    target: string;
    change: (course: IntegrationCourse, edits: Edits, state: NodeState) => Promise<unknown>;
  }
> = {
  title: {
    target: 'node-title',
    async change(course, edits, state) {
      const node = await addNode(course, 'Árboles', STATE[state]);
      await edits.rename(node.id, 'Árboles binarios');
    },
  },
  description: {
    target: 'node-description',
    async change(course, edits, state) {
      const node = await addNode(course, 'Árboles', { ...STATE[state], description: 'Antes' });
      await edits.update(node.id, { description: 'Después' });
    },
  },
  Resource: {
    target: 'resource',
    async change(course, edits, state) {
      const node = await addNode(course, 'Árboles', STATE[state]);
      await edits.addResource(node.id, 'Guía 3');
    },
  },
  'Node type': {
    target: 'node-type',
    async change(course, edits, state) {
      const [node, workshop] = await Promise.all([
        addNode(course, 'Árboles', STATE[state]),
        addType(course, 'Taller'),
      ]);
      await edits.update(node.id, { nodeTypeId: workshop.id });
    },
  },
  creation: {
    target: 'node-creation',
    async change(_course, edits, state) {
      const node = await edits.create('Árboles');
      await applyState(edits, node.id, state);
    },
  },
  deletion: {
    target: 'node-deletion',
    async change(course, edits, state) {
      const node = await addNode(course, 'Árboles', STATE[state]);
      await edits.remove(node.id);
    },
  },
  Dependency: {
    target: 'dependency',
    async change(course, edits, state) {
      const node = await addNode(course, 'Árboles', STATE[state]);
      await edits.connect(course.change.nodeId, node.id);
    },
  },
};

// Students are told what they can see (ADR-0014 decision 10): never a hidden Node, and on a
// Blocked node only its title, Node type, creation, deletion and Dependencies.
const STUDENT_TOLD: Record<string, NodeState[]> = {
  title: ['visible', 'Teacher-blocked'],
  description: ['visible'],
  Resource: ['visible'],
  'Node type': ['visible', 'Teacher-blocked'],
  creation: ['visible', 'Teacher-blocked'],
  deletion: ['visible', 'Teacher-blocked'],
  Dependency: ['visible', 'Teacher-blocked'],
};

const MATRIX = Object.keys(CHANGES).flatMap((change) =>
  (Object.keys(STATE) as NodeState[])
    // A hidden Node has no Dependencies: hiding removes them and none can be added.
    .filter((state) => change !== 'Dependency' || state !== 'hidden')
    .map((state) => [change, state] as const),
);

test.for(MATRIX)(
  'a %s change on a %s Node: teaching staff are always told, students as they see it',
  async ([change, state], { course }) => {
    const { target, change: makeChange } = CHANGES[change];
    await makeChange(course, teacherEdits(course), state);
    const told = async (userId: string) =>
      (await pendingNotices(userId, course.roadmapId)).filter(
        (notice) => noticeTarget(notice) === target,
      ).length;
    expect({
      colleague: await told(course.colleagueId),
      student: await told(course.studentId),
      actor: await told(course.teacherId),
    }).toEqual({
      colleague: 1,
      student: STUDENT_TOLD[change].includes(state) ? 1 : 0,
      actor: 0,
    });
  },
);

test.for(['hidden', 'Teacher-blocked'] as const)(
  'a description notice pending when its Node becomes %s stays shown to teaching staff only',
  async (state, { course }) => {
    const node = await addNode(course, 'Pilas', { description: 'Antes' });
    const edits = teacherEdits(course);
    await edits.update(node.id, { description: 'Después' });
    await applyState(edits, node.id, state);
    const params = new URLSearchParams({ roadmapId: course.roadmapId });
    const shown = async (userId: string) => ({
      targets: (await pendingNotices(userId, course.roadmapId)).map(noticeTarget).sort(),
      counts: await countOwnNotices(userId, params),
      marks: await countOwnNodeChangeTargets(userId, params),
    });
    // Node access notices are per recipient, as before: hiding or blocking tells everyone.
    expect(await shown(course.colleagueId)).toEqual({
      targets: ['node-access', 'node-description'],
      counts: { count: 2 },
      marks: { byNode: { [node.id]: 2 } },
    });
    expect(await shown(course.studentId)).toEqual({
      targets: ['node-access'],
      counts: { count: 1 },
      marks: { byNode: { [node.id]: 1 } },
    });
  },
);

test('a Dependency notice pending when its Node is hidden stays shown to teaching staff only', async ({
  course,
}) => {
  const node = await addNode(course, 'Árboles');
  const edits = teacherEdits(course);
  await edits.connect(course.change.nodeId, node.id);
  await edits.update(node.id, { isVisible: false });
  const targets = async (userId: string) =>
    (await pendingNotices(userId, course.roadmapId)).map(noticeTarget).sort();
  expect(await targets(course.colleagueId)).toEqual(['dependency', 'node-access']);
  expect(await targets(course.studentId)).toEqual(['node-access']);
});

test('a rename while the Node is hidden reaches teaching staff as a rename; revealing it does not', async ({
  course,
}) => {
  const node = await addNode(course, 'Heaps');
  const edits = teacherEdits(course);
  await edits.update(node.id, { isVisible: false });
  await edits.rename(node.id, 'Montículos');
  const titles = async (userId: string) =>
    (await pendingNotices(userId, course.roadmapId))
      .filter((notice) => noticeTarget(notice) === 'node-title')
      .map(({ body }) => body);
  expect(await titles(course.colleagueId)).toEqual(['«Heaps» pasó a llamarse «Montículos».']);
  expect(await titles(course.studentId)).toEqual([]);
  // To students, as before, hiding and revealing returns the Node to the access they knew,
  // and the rename made in between is no title change.
  await edits.update(node.id, { isVisible: true });
  expect(await pendingNotices(course.studentId, course.roadmapId)).toEqual([]);
  expect(await titles(course.colleagueId)).toEqual(['«Heaps» pasó a llamarse «Montículos».']);
});

test('teaching staff recognize changes on a hidden Node as on a visible one', async ({
  course,
}) => {
  const node = await addNode(course, 'Heaps', { isVisible: false, description: 'Antes' });
  const edits = teacherEdits(course);
  // The first entry shows no Change summary.
  await enterRoadmap(course.colleagueId, course.roadmapId);
  await edits.rename(node.id, 'Montículos');
  await edits.update(node.id, { description: 'Después' });
  expect(await enterRoadmap(course.colleagueId, course.roadmapId)).toEqual({
    acknowledged: 2,
    summary: {
      courseCode: course.identifier.courseCode,
      groups: [
        {
          title: 'Montículos',
          items: ['Se actualizó la descripción.', '«Heaps» pasó a llamarse «Montículos».'],
        },
      ],
    },
  });
  expect(await pendingNotices(course.colleagueId, course.roadmapId)).toEqual([]);
  await edits.rename(node.id, 'Montículos binarios');
  expect(await pendingNotices(course.colleagueId, course.roadmapId)).toMatchObject([
    { body: '«Montículos» pasó a llamarse «Montículos binarios».' },
  ]);
});

test('revealing a Node changed while hidden tells students only that it is back', async ({
  course,
}) => {
  const node = await addNode(course, 'Heaps', { isVisible: false, description: 'Antes' });
  const edits = teacherEdits(course);
  await edits.rename(node.id, 'Montículos');
  await edits.update(node.id, { description: 'Después' });
  await edits.addResource(node.id, 'Guía 3');
  await edits.update(node.id, { isVisible: true });
  const told = async (userId: string) =>
    (await pendingNotices(userId, course.roadmapId)).map(({ body }) => body).sort();
  expect(await told(course.studentId)).toEqual(['«Montículos» volvió a mostrarse en el Roadmap.']);
  expect(await told(course.colleagueId)).toEqual([
    'Nuevo recurso «Guía 3» en «Montículos».',
    'Se actualizó la descripción de «Montículos».',
    '«Heaps» pasó a llamarse «Montículos».',
    '«Montículos» volvió a mostrarse en el Roadmap.',
  ]);
});
