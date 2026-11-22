import 'dotenv/config';
import { expect } from 'vitest';
import { teacher, test, type IntegrationCourse } from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import { recordingChangePort } from './support/recording-change-port';
import {
  changeTeacherBlock,
  createRoadmapDependency,
  deleteRoadmapNode,
  readRoadmapChangeImpact,
  updateRoadmapNode,
} from '@/features/roadmap/server';

function addNode(course: IntegrationCourse, title: string) {
  return prisma.roadmapNode.create({
    data: {
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title,
      positionX: 0,
      positionY: 0,
    },
  });
}

function connect(sourceNodeId: string, targetNodeId: string) {
  return prisma.dependency.create({ data: { sourceNodeId, targetNodeId } });
}

test('hiding a Node checks a sent Change impact version against the removed Dependencies', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  const [dependent, prerequisite] = [
    await addNode(course, 'Pilas'),
    await addNode(course, 'Colas'),
  ];
  await connect(nodeId, dependent.id);
  const earlier = await readRoadmapChangeImpact({
    ...teacher(course),
    input: { kind: 'hide-node', nodeId: nodeId },
  });
  await connect(prerequisite.id, nodeId);
  const hide = (changeImpactVersion?: string) =>
    updateRoadmapNode(
      { ...teacher(course), id: nodeId, input: { isVisible: false }, changeImpactVersion },
      recording.port,
    );

  await expect(hide(earlier.version)).rejects.toMatchObject({
    status: 409,
    code: 'NODE_VISIBILITY_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await readRoadmapChangeImpact({
    ...teacher(course),
    input: { kind: 'hide-node', nodeId: nodeId },
  });
  expect(current.dependencies).toHaveLength(2);
  await expect(hide(current.version)).resolves.toMatchObject({
    node: { isVisible: false },
    dependencies: current.dependencies,
  });
});

test('hiding a Node without a Change impact version is refused as stale, while showing it needs none', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  await connect(nodeId, (await addNode(course, 'Pilas')).id);
  const setVisibility = (isVisible: boolean) =>
    updateRoadmapNode({ ...teacher(course), id: nodeId, input: { isVisible } }, recording.port);

  await expect(setVisibility(false)).rejects.toMatchObject({
    status: 409,
    code: 'NODE_VISIBILITY_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const { version } = await readRoadmapChangeImpact({
    ...teacher(course),
    input: { kind: 'hide-node', nodeId: nodeId },
  });
  await updateRoadmapNode(
    { ...teacher(course), id: nodeId, input: { isVisible: false }, changeImpactVersion: version },
    recording.port,
  );
  await expect(setVisibility(true)).resolves.toMatchObject({ node: { isVisible: true } });
});

test('BLOCK checks a sent Change impact version against the Nodes it blocks', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  await connect(nodeId, (await addNode(course, 'Pilas')).id);
  const request = { ...teacher(course), id: nodeId, operation: 'BLOCK' as const };
  const readImpact = () =>
    readRoadmapChangeImpact({
      ...teacher(course),
      input: { kind: 'change-teacher-block', nodeId, operation: 'BLOCK' },
    });
  const earlier = await readImpact();
  await connect(nodeId, (await addNode(course, 'Colas')).id);
  const block = (changeImpactVersion?: string) =>
    changeTeacherBlock({ ...request, changeImpactVersion }, recording.port);

  await expect(block(earlier.version)).rejects.toMatchObject({
    status: 409,
    code: 'TEACHER_BLOCK_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await readImpact();
  expect(current.nodes).toHaveLength(3);
  await expect(block(current.version)).resolves.toMatchObject({ nodes: current.nodes });
});

test('BLOCK without a Change impact version is refused as stale', async ({ course }) => {
  const recording = recordingChangePort();

  await expect(
    changeTeacherBlock(
      { ...teacher(course), id: course.change.nodeId, operation: 'BLOCK' },
      recording.port,
    ),
  ).rejects.toMatchObject({ status: 409, code: 'TEACHER_BLOCK_PREVIEW_STALE' });
  expect(recording.changes).toEqual([]);
});

test('Dependency creation checks a sent Change impact version against the Teacher blocks it adds', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const source = await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { isTeacherBlocked: true },
  });
  const target = await addNode(course, 'Pilas');
  const request = {
    ...teacher(course),
    input: { sourceNodeId: source.id, targetNodeId: target.id },
  };
  const earlier = await readRoadmapChangeImpact({
    ...request,
    input: { kind: 'create-dependency', ...request.input },
  });
  await connect(target.id, (await addNode(course, 'Colas')).id);
  const create = (changeImpactVersion?: string) =>
    createRoadmapDependency({ ...request, changeImpactVersion }, recording.port);

  await expect(create(earlier.version)).rejects.toMatchObject({
    status: 409,
    code: 'DEPENDENCY_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await readRoadmapChangeImpact({
    ...request,
    input: { kind: 'create-dependency', ...request.input },
  });
  expect(current.nodes).toHaveLength(2);
  await expect(create(current.version)).resolves.toMatchObject({ nodes: current.nodes });
});

test('Dependency creation without a Change impact version is refused as stale, even when it blocks nothing', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const target = await addNode(course, 'Pilas');

  await expect(
    createRoadmapDependency(
      {
        ...teacher(course),
        input: { sourceNodeId: course.change.nodeId, targetNodeId: target.id },
      },
      recording.port,
    ),
  ).rejects.toMatchObject({ status: 409, code: 'DEPENDENCY_PREVIEW_STALE' });
  expect(recording.changes).toEqual([]);
});

test('Node deletion without a Change impact version is refused as stale', async ({ course }) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  const remove = (changeImpactVersion?: string) =>
    deleteRoadmapNode({ ...teacher(course), id: nodeId, changeImpactVersion }, recording.port);

  await expect(remove()).rejects.toMatchObject({ status: 409, code: 'NODE_DELETE_PREVIEW_STALE' });
  expect(recording.changes).toEqual([]);

  const { version } = await readRoadmapChangeImpact({
    ...teacher(course),
    input: { kind: 'delete-node', nodeId: nodeId },
  });
  await expect(remove(version)).resolves.toEqual({});
});

test.for<[Record<string, string>, string]>([
  [
    { kind: 'show-node' },
    'kind debe ser hide-node, delete-node, change-teacher-block o create-dependency.',
  ],
  [{ kind: 'hide-node', nodeId: 'not-a-node' }, 'nodeId debe ser un UUID válido.'],
  [
    { kind: 'change-teacher-block', operation: 'HIDE' },
    'operation debe ser BLOCK, UNBLOCK o BRANCH_UNLOCK.',
  ],
  [
    { kind: 'create-dependency', sourceHandle: 'middle' },
    'sourceHandle debe ser un punto válido del nodo.',
  ],
])(
  'reading the Change impact of %o is refused as an invalid request',
  async ([input, message], { course }) => {
    const nodeIds = { nodeId: course.change.nodeId, sourceNodeId: course.change.nodeId };
    const target = await addNode(course, 'Pilas');

    await expect(
      readRoadmapChangeImpact({
        ...teacher(course),
        input: { ...nodeIds, targetNodeId: target.id, ...input },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST', message });
  },
);

test('reading the Change impact of a Dependency accepts its handles and Teacher block operations', async ({
  course,
}) => {
  const nodeId = course.change.nodeId;
  const target = await addNode(course, 'Pilas');
  const read = (input: Record<string, string>) =>
    readRoadmapChangeImpact({ ...teacher(course), input });

  await expect(
    read({
      kind: 'create-dependency',
      sourceNodeId: nodeId,
      targetNodeId: target.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    }),
  ).resolves.toMatchObject({ version: expect.any(String) });
  for (const operation of ['UNBLOCK', 'BRANCH_UNLOCK'])
    await expect(read({ kind: 'change-teacher-block', nodeId, operation })).resolves.toMatchObject({
      version: expect.any(String),
    });
});
