import { randomUUID } from 'node:crypto';
import { prisma } from '@/shared/server/db';
import { scheduledRoadmapChangePort } from '@/app/_adapters/roadmap-changes';
import {
  acknowledgeOwnNotices,
  listOwnNotices,
  prepareOwnRoadmapOpening,
  recordRoadmapNotices,
  type NoticeDelivery,
} from '@/features/notifications/server';
import {
  changeTeacherBlock,
  createRoadmapDependency,
  createRoadmapNode,
  deleteRoadmapDependency,
  createRoadmapResource,
  deleteRoadmapNode,
  previewNodeVisibility,
  previewRoadmapDependency,
  previewTeacherBlock,
  removeRoadmapResource,
  updateRoadmapNode,
  updateRoadmapNodeType,
  updateRoadmapResource,
  type RoadmapChangePort,
} from '@/features/roadmap/server';
import type { TeacherBlockOperation } from '@/features/roadmap/types';
import { teacher, type IntegrationCourse } from './fixtures';

/**
 * Real Roadmap edits by the course teacher, delivered immediately after commit. A change
 * with a Change impact confirms it as the canvas does: it previews and sends the version.
 */
export function teacherEdits(
  course: IntegrationCourse,
  port: RoadmapChangePort = scheduledRoadmapChangePort,
) {
  const editor = teacher(course);
  const changeTeacherBlockConfirmed = async (nodeId: string, operation: TeacherBlockOperation) => {
    const input = { ...editor, id: nodeId, operation };
    const { version } = await previewTeacherBlock(input);
    return changeTeacherBlock({ ...input, previewVersion: version }, port);
  };
  return {
    create: (title: string) =>
      createRoadmapNode(
        {
          ...editor,
          input: { title, nodeTypeId: course.nodeTypeId, positionX: 30, positionY: 40 },
        },
        port,
      ),
    rename: (nodeId: string, title: string) =>
      updateRoadmapNode({ ...editor, id: nodeId, input: { title } }, port),
    async update(nodeId: string, input: Record<string, unknown>) {
      const previewVersion =
        input.isVisible === false
          ? (await previewNodeVisibility({ ...editor, id: nodeId })).version
          : undefined;
      return updateRoadmapNode({ ...editor, id: nodeId, input, previewVersion }, port);
    },
    remove: (nodeId: string) => deleteRoadmapNode({ ...editor, id: nodeId }, port),
    block: (nodeId: string) => changeTeacherBlockConfirmed(nodeId, 'BLOCK'),
    unblock: (nodeId: string) => changeTeacherBlockConfirmed(nodeId, 'UNBLOCK'),
    renameType: (nodeTypeId: string, name: string) =>
      updateRoadmapNodeType({ ...editor, id: nodeTypeId, input: { name } }, port),
    async connect(sourceNodeId: string, targetNodeId: string) {
      const request = { ...editor, input: { sourceNodeId, targetNodeId } };
      const { version } = await previewRoadmapDependency(request);
      return (await createRoadmapDependency({ ...request, previewVersion: version }, port))
        .dependency.id;
    },
    disconnect: (dependencyId: string) =>
      deleteRoadmapDependency({ ...editor, id: dependencyId }, port),
    updateType: (nodeTypeId: string, input: Record<string, unknown>) =>
      updateRoadmapNodeType({ ...editor, id: nodeTypeId, input }, port),
    addResource: (nodeId: string, title: string, url = 'https://example.test/guide') =>
      createRoadmapResource({ ...editor, id: nodeId, input: { title, url, type: 'LINK' } }, port),
    editResource: (resourceId: string, input: Record<string, unknown>) =>
      updateRoadmapResource({ ...editor, id: resourceId, input }, port),
    removeResource: (resourceId: string) =>
      removeRoadmapResource({ ...editor, id: resourceId }, port),
  };
}

export function addType(course: IntegrationCourse, name: string) {
  return prisma.nodeType.create({
    data: {
      roadmapId: course.roadmapId,
      name,
      normalizedName: name.toLowerCase(),
      icon: 'BookOpen',
      color: '#024AD8',
    },
  });
}

export function addNode(
  course: IntegrationCourse,
  title: string,
  state: { isVisible?: boolean; isTeacherBlocked?: boolean; description?: string } = {},
) {
  return prisma.roadmapNode.create({
    data: {
      roadmapId: course.roadmapId,
      nodeTypeId: course.nodeTypeId,
      title,
      positionX: 10,
      positionY: 20,
      ...state,
    },
  });
}

export async function pendingNotices(userId: string, roadmapId: string) {
  return (await listOwnNotices(userId, new URLSearchParams({ roadmapId, limit: '100' })))
    .notifications;
}

/** Enter the Roadmap: capture the pending notices and recognize them. */
export async function enterRoadmap(userId: string, roadmapId: string) {
  const opening = await prepareOwnRoadmapOpening(userId, {
    roadmapId,
    operationId: randomUUID(),
  });
  return acknowledgeOwnNotices(userId, opening);
}

/** A port that records through the notice lifecycle module and lets the test run each delivery. */
export function deferredNoticePort() {
  const deliveries: NoticeDelivery[] = [];
  const port: RoadmapChangePort = {
    async report(transaction, changes) {
      const delivery = await recordRoadmapNotices(transaction, changes);
      if (delivery) deliveries.push(delivery);
    },
  };
  return {
    port,
    deliveries,
    deliver: (delivery: NoticeDelivery) => delivery((persist) => persist()),
  };
}

/** The Roadmap became available: recorded and delivered through the notice lifecycle module. */
export async function announceRoadmap(course: IntegrationCourse) {
  const offering = await prisma.courseOffering.findFirstOrThrow({
    where: { roadmap: { id: course.roadmapId } },
  });
  const delivery = await prisma.$transaction((transaction) =>
    recordRoadmapNotices(transaction, {
      actorId: course.teacherId,
      roadmapId: course.roadmapId,
      identifier: course.identifier,
      facts: [
        {
          kind: 'roadmap-created',
          previous: null,
          current: {
            courseOfferingId: offering.id,
            courseName: 'Curso de prueba',
            actorName: 'Docente',
            occurredAt: new Date(),
          },
        },
      ],
    }),
  );
  await delivery?.((persist) => persist());
}
