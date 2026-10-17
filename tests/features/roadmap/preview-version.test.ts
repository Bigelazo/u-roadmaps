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

  const unconfirmed = await addNode(course, 'Árboles');
  await connect(unconfirmed.id, dependent.id);
  await expect(
    updateRoadmapNode(
      { ...teacher(course), id: unconfirmed.id, input: { isVisible: false } },
      recording.port,
    ),
  ).resolves.toMatchObject({ node: { isVisible: false }, dependencies: [expect.anything()] });
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

  const unconfirmed = await addNode(course, 'Árboles');
  await expect(
    changeTeacherBlock({ ...request, id: unconfirmed.id }, recording.port),
  ).resolves.toMatchObject({ nodes: [{ id: unconfirmed.id }] });
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

  const unconfirmed = await addNode(course, 'Árboles');
  await expect(
    createRoadmapDependency(
      { ...request, input: { sourceNodeId: source.id, targetNodeId: unconfirmed.id } },
      recording.port,
    ),
  ).resolves.toMatchObject({ nodes: [{ id: unconfirmed.id }] });
});
