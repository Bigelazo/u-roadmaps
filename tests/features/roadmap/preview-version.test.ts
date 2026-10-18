// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { beforeAll, expect } from 'vitest';
import { teacher, test, type IntegrationCourse } from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import { recordingChangePort } from './support/recording-change-port';
import {
  changeTeacherBlock,
  createRoadmapDependency,
  deleteRoadmapNode,
  previewNodeDeletion,
  previewNodeVisibility,
  previewRoadmapDependency,
  previewTeacherBlock,
  updateRoadmapNode,
} from '@/features/roadmap/server';

beforeAll(databaseSetup, 60_000);

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

test('hiding a Node checks a sent visibility preview version against the removed Dependencies', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  const [dependent, prerequisite] = [
    await addNode(course, 'Pilas'),
    await addNode(course, 'Colas'),
  ];
  await connect(nodeId, dependent.id);
  const preview = await previewNodeVisibility({ ...teacher(course), id: nodeId });
  await connect(prerequisite.id, nodeId);
  const hide = (previewVersion?: string) =>
    updateRoadmapNode(
      { ...teacher(course), id: nodeId, input: { isVisible: false }, previewVersion },
      recording.port,
    );

  await expect(hide(preview.version)).rejects.toMatchObject({
    status: 409,
    code: 'NODE_VISIBILITY_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await previewNodeVisibility({ ...teacher(course), id: nodeId });
  expect(current.dependencies).toHaveLength(2);
  await expect(hide(current.version)).resolves.toMatchObject({
    node: { isVisible: false },
    dependencies: current.dependencies,
  });
});

test('hiding a Node without a visibility preview version is refused as stale, while showing it needs none', async ({
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

  const { version } = await previewNodeVisibility({ ...teacher(course), id: nodeId });
  await updateRoadmapNode(
    { ...teacher(course), id: nodeId, input: { isVisible: false }, previewVersion: version },
    recording.port,
  );
  await expect(setVisibility(true)).resolves.toMatchObject({ node: { isVisible: true } });
});

test('BLOCK checks a sent Teacher block preview version against the Nodes it blocks', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  await connect(nodeId, (await addNode(course, 'Pilas')).id);
  const request = { ...teacher(course), id: nodeId, operation: 'BLOCK' as const };
  const preview = await previewTeacherBlock(request);
  await connect(nodeId, (await addNode(course, 'Colas')).id);
  const block = (previewVersion?: string) =>
    changeTeacherBlock({ ...request, previewVersion }, recording.port);

  await expect(block(preview.version)).rejects.toMatchObject({
    status: 409,
    code: 'TEACHER_BLOCK_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await previewTeacherBlock(request);
  expect(current.nodes).toHaveLength(3);
  await expect(block(current.version)).resolves.toMatchObject({ nodes: current.nodes });
});

test('BLOCK without a Teacher block preview version is refused as stale', async ({ course }) => {
  const recording = recordingChangePort();

  await expect(
    changeTeacherBlock(
      { ...teacher(course), id: course.change.nodeId, operation: 'BLOCK' },
      recording.port,
    ),
  ).rejects.toMatchObject({ status: 409, code: 'TEACHER_BLOCK_PREVIEW_STALE' });
  expect(recording.changes).toEqual([]);
});

test('Dependency creation checks a sent Dependency preview version against the Teacher blocks it adds', async ({
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
  const preview = await previewRoadmapDependency(request);
  await connect(target.id, (await addNode(course, 'Colas')).id);
  const create = (previewVersion?: string) =>
    createRoadmapDependency({ ...request, previewVersion }, recording.port);

  await expect(create(preview.version)).rejects.toMatchObject({
    status: 409,
    code: 'DEPENDENCY_PREVIEW_STALE',
  });
  expect(recording.changes).toEqual([]);

  const current = await previewRoadmapDependency(request);
  expect(current.nodes).toHaveLength(2);
  await expect(create(current.version)).resolves.toMatchObject({ nodes: current.nodes });
});

test('Dependency creation without a Dependency preview version is refused as stale, even when it blocks nothing', async ({
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

test('Node deletion without a deletion preview version is refused as stale', async ({ course }) => {
  const recording = recordingChangePort();
  const nodeId = course.change.nodeId;
  const remove = (previewVersion?: string) =>
    deleteRoadmapNode({ ...teacher(course), id: nodeId, previewVersion }, recording.port);

  await expect(remove()).rejects.toMatchObject({ status: 409, code: 'NODE_DELETE_PREVIEW_STALE' });
  expect(recording.changes).toEqual([]);

  const { version } = await previewNodeDeletion({ ...teacher(course), id: nodeId });
  await expect(remove(version)).resolves.toEqual({});
});
