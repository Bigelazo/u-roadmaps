import { randomUUID } from 'node:crypto';
import type { ResultAsync } from 'neverthrow';
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
  previewTeacherBlock,
  removeRoadmapResource,
  updateRoadmapNode,
  updateRoadmapNodeType,
  updateRoadmapResource,
  type RoadmapChangePort,
} from '@/features/roadmap/server';
import type { IntegrationCourse } from './fixtures';

export function confirmed<T, E>(result: ResultAsync<T, E>) {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

/** Real Roadmap edits by the course teacher, delivered immediately after commit. */
export function teacherEdits(
  course: IntegrationCourse,
  port: RoadmapChangePort = scheduledRoadmapChangePort,
) {
  const editor = { userId: course.teacherId, identifier: course.identifier };
  return {
    create: (title: string) =>
      confirmed(
        createRoadmapNode(
          {
            ...editor,
            input: { title, nodeTypeId: course.nodeTypeId, positionX: 30, positionY: 40 },
          },
          port,
        ),
      ),
    rename: (nodeId: string, title: string) =>
      confirmed(updateRoadmapNode({ ...editor, id: nodeId, input: { title } }, port)),
    update: (nodeId: string, input: Record<string, unknown>) =>
      confirmed(updateRoadmapNode({ ...editor, id: nodeId, input }, port)),
    remove: (nodeId: string) => confirmed(deleteRoadmapNode({ ...editor, id: nodeId }, port)),
    block: (nodeId: string) =>
      confirmed(changeTeacherBlock({ ...editor, id: nodeId, operation: 'BLOCK' }, port)),
    async unblock(nodeId: string) {
      const input = { ...editor, id: nodeId, operation: 'UNBLOCK' as const };
      const preview = await confirmed(previewTeacherBlock(input));
      return confirmed(changeTeacherBlock({ ...input, previewVersion: preview.version }, port));
    },
    renameType: (nodeTypeId: string, name: string) =>
      confirmed(updateRoadmapNodeType({ ...editor, id: nodeTypeId, input: { name } }, port)),
    connect: async (sourceNodeId: string, targetNodeId: string) =>
      (
        await confirmed(
          createRoadmapDependency({ ...editor, input: { sourceNodeId, targetNodeId } }, port),
        )
      ).dependency.id,
    disconnect: (dependencyId: string) =>
      confirmed(deleteRoadmapDependency({ ...editor, id: dependencyId }, port)),
    updateType: (nodeTypeId: string, input: Record<string, unknown>) =>
      confirmed(updateRoadmapNodeType({ ...editor, id: nodeTypeId, input }, port)),
    addResource: (nodeId: string, title: string, url = 'https://example.test/guide') =>
      confirmed(
        createRoadmapResource({ ...editor, id: nodeId, input: { title, url, type: 'LINK' } }, port),
      ),
    editResource: (resourceId: string, input: Record<string, unknown>) =>
      confirmed(updateRoadmapResource({ ...editor, id: resourceId, input }, port)),
    removeResource: (resourceId: string) =>
      confirmed(removeRoadmapResource({ ...editor, id: resourceId }, port)),
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
