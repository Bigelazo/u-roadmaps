import { expect } from 'vitest';
import { test, type IntegrationCourse } from './fixtures';
import { addNode, addType, enterRoadmap, pendingNotices, teacherEdits } from './roadmap';

type Notice = Awaited<ReturnType<typeof pendingNotices>>[number];

const targetOf = ({ data }: Notice) => (data as { noticeTarget?: string }).noticeTarget;

/** Teacher A is the course teacher; teacher B is a colleague on the same Roadmap. */
function teachers(course: IntegrationCourse) {
  return {
    a: teacherEdits(course),
    b: teacherEdits({ ...course, teacherId: course.colleagueId }),
    pending: async (noticeTarget: string) =>
      (await pendingNotices(course.teacherId, course.roadmapId)).filter(
        (notice) => targetOf(notice) === noticeTarget,
      ),
    recognize: () => enterRoadmap(course.teacherId, course.roadmapId),
  };
}

test('A’s own rename advances A’s Known title: B’s revert is news to A', async ({ course }) => {
  const node = await addNode(course, 'X');
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await a.rename(node.id, 'Y');
  expect(await pendingNotices(course.teacherId, course.roadmapId)).toEqual([]);
  await b.rename(node.id, 'X');
  expect(await pending('node-title')).toMatchObject([{ body: '«Y» pasó a llamarse «X».' }]);
});

test('A’s pending notice absorbs A’s own rename and is withdrawn on A’s return to the Known value', async ({
  course,
}) => {
  const node = await addNode(course, 'X');
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await b.rename(node.id, 'Y');
  const [first] = await pending('node-title');
  expect(first).toMatchObject({ body: '«X» pasó a llamarse «Y».' });
  await a.rename(node.id, 'Z');
  expect(await pending('node-title')).toMatchObject([
    { id: first.id, body: '«X» pasó a llamarse «Z».' },
  ]);
  await a.rename(node.id, 'X');
  expect(await pending('node-title')).toEqual([]);
});

test('description: B’s revert of A’s change is news to A', async ({ course }) => {
  const node = await addNode(course, 'Pilas', { description: 'Antes' });
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await a.update(node.id, { description: 'Después' });
  expect(await pending('node-description')).toEqual([]);
  await b.update(node.id, { description: 'Antes' });
  expect(await pending('node-description')).toHaveLength(1);
});

test('type: B’s revert of A’s change is news to A', async ({ course }) => {
  const node = await addNode(course, 'Pilas');
  const workshop = await addType(course, 'Taller');
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await a.update(node.id, { nodeTypeId: workshop.id });
  expect(await pending('node-type')).toEqual([]);
  await b.update(node.id, { nodeTypeId: course.nodeTypeId });
  expect(await pending('node-type')).toHaveLength(1);
});

test('access: B’s unblock of A’s block is news to A', async ({ course }) => {
  const node = await addNode(course, 'Pilas');
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await a.block(node.id);
  expect(await pending('node-access')).toEqual([]);
  await b.unblock(node.id);
  expect(await pending('node-access')).toHaveLength(1);
});

test('Resource: B’s revert of A’s edit is news to A', async ({ course }) => {
  const nodeId = course.change.nodeId;
  const { a, b, pending, recognize } = teachers(course);
  const resource = await a.addResource(nodeId, 'Guía');
  await recognize();
  await a.editResource(resource.id, { title: 'Guía resuelta' });
  expect(await pending('resource')).toEqual([]);
  await b.editResource(resource.id, { title: 'Guía' });
  expect(await pending('resource')).toHaveLength(1);
});

test('Dependency pair: B’s removal of A’s Dependency is news to A', async ({ course }) => {
  const first = await addNode(course, 'Pilas');
  const second = await addNode(course, 'Colas');
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  const dependency = await a.connect(first.id, second.id);
  expect(await pending('dependency')).toEqual([]);
  await b.disconnect(dependency);
  expect(await pending('dependency')).toHaveLength(1);
});

test('Node type name: B’s revert of A’s rename is news to A', async ({ course }) => {
  const { a, b, pending, recognize } = teachers(course);
  await recognize();
  await a.renameType(course.nodeTypeId, 'Unidad');
  expect(await pending('node-type-name')).toEqual([]);
  await b.renameType(course.nodeTypeId, 'Tema');
  expect(await pending('node-type-name')).toHaveLength(1);
});
