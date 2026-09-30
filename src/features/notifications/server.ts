import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/shared/server/db';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';
import type { NodeChangeNotice, RoadmapAvailabilityNotice } from './contracts';
import { emitRoadmapAvailability } from './application/emit-roadmap-availability';
import { emitNodeChange } from './application/emit-node-change';
import { novuTransport } from './infrastructure/novu-transport';
import { createSubscriberHash } from './infrastructure/subscriber-hash';

export type InboxIdentity = Readonly<{
  subscriber: string;
  subscriberHash: string;
  applicationIdentifier: string;
  apiUrl?: string;
  socketUrl?: string;
}>;

export function notificationsEnabled() {
  return (
    process.env.NOVU_NOTIFICATIONS_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' || process.env.NOVU_PRODUCTION_APPROVED === 'true')
  );
}

export function getInboxIdentity(userId: string): InboxIdentity | null {
  const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
  const secretKey = process.env.NOVU_SECRET_KEY;
  if (!notificationsEnabled() || !applicationIdentifier || !secretKey) return null;

  return {
    subscriber: userId,
    subscriberHash: createSubscriberHash(userId, secretKey),
    applicationIdentifier,
    ...(process.env.NEXT_PUBLIC_NOVU_API_URL
      ? { apiUrl: process.env.NEXT_PUBLIC_NOVU_API_URL }
      : {}),
    ...(process.env.NEXT_PUBLIC_NOVU_SOCKET_URL
      ? { socketUrl: process.env.NEXT_PUBLIC_NOVU_SOCKET_URL }
      : {}),
  };
}

export async function deliverRoadmapAvailability(notice: RoadmapAvailabilityNotice) {
  const workflowId = process.env.NOVU_WORKFLOW_ROADMAP_AVAILABLE;
  if (!notificationsEnabled() || !workflowId) return;

  await emitRoadmapAvailability(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: {
          courseOfferingId: notice.courseOfferingId,
          userId: { in: [...userIds] },
          isActive: true,
        },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => {
    // Novu is best-effort: delivery cannot change the committed mutation result.
  });
}

export async function deliverNodeChange(input: {
  userId: string;
  courseCode: string;
  year: number;
  semester: number;
  nodeId: string;
  changeKind: NodeChangeNotice['changeKind'];
  changedFields: NodeChangeNotice['changedFields'];
}) {
  if (!notificationsEnabled()) return;
  const workflowId = process.env.NOVU_WORKFLOW_NODE_CHANGE;
  if (!workflowId) return;

  const node = await prisma.roadmapNode.findUnique({
    where: { id: input.nodeId },
    include: {
      nodeType: { select: { name: true } },
      roadmap: {
        include: {
          courseOffering: { include: { course: true } },
        },
      },
    },
  });
  if (
    !node?.isVisible ||
    node.roadmap.courseOffering.courseCode !== input.courseCode ||
    node.roadmap.courseOffering.year !== input.year ||
    node.roadmap.courseOffering.semester !== input.semester
  )
    return;

  const offering = node.roadmap.courseOffering;
  const [participants, visibleNodes, dependencies] = await Promise.all([
    prisma.participation.findMany({
      where: { courseOfferingId: offering.id, isActive: true, userId: { not: input.userId } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.roadmapNode.findMany({
      where: { roadmapId: node.roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    prisma.dependency.findMany({
      where: { sourceNode: { roadmapId: node.roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
  const visibleDependencies = dependencies.filter(
    ({ sourceNodeId, targetNodeId }) =>
      visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId),
  );
  const studentParticipants = participants.filter(({ role }) => role === 'STUDENT');
  const completions = studentParticipants.length
    ? await prisma.completion.findMany({
        where: {
          userId: { in: studentParticipants.map(({ userId }) => userId) },
          roadmapNode: { roadmapId: node.roadmapId },
        },
        select: { userId: true, roadmapNodeId: true },
      })
    : [];
  const completionIdsByUser = new Map<string, Set<string>>();
  for (const completion of completions) {
    const completed = completionIdsByUser.get(completion.userId) ?? new Set<string>();
    completed.add(completion.roadmapNodeId);
    completionIdsByUser.set(completion.userId, completed);
  }
  const recipients = participants.flatMap((participant) => {
    if (participant.role === 'TEACHER') {
      return node.isTeacherBlocked
        ? []
        : [{ userId: participant.user.id, name: participant.user.name }];
    }
    const access = studentNodeAccessById({
      nodes: visibleNodes,
      dependencies: visibleDependencies,
      completedNodeIds: completionIdsByUser.get(participant.userId) ?? new Set(),
    }).get(node.id);
    return access?.status === 'ACCESSIBLE'
      ? [{ userId: participant.user.id, name: participant.user.name }]
      : [];
  });
  if (!recipients.length) return;

  const notice: NodeChangeNotice = {
    eventId: randomUUID(),
    roadmapId: node.roadmapId,
    courseOfferingId: offering.id,
    courseCode: offering.courseCode,
    year: offering.year,
    semester: offering.semester,
    courseName: offering.course.name,
    nodeId: node.id,
    nodeTitle: node.title,
    changeKind: input.changeKind,
    changedFields: input.changedFields,
    actorId: input.userId,
    actorName:
      (await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }))
        ?.name ?? 'Equipo docente',
    occurredAt: new Date(),
    recipients,
  };

  await emitNodeChange(
    notice,
    novuTransport,
    async (userIds) => {
      const active = await prisma.participation.findMany({
        where: { courseOfferingId: offering.id, userId: { in: [...userIds] }, isActive: true },
        select: { userId: true },
      });
      return active.map(({ userId }) => userId);
    },
    workflowId,
  ).catch(() => undefined);
}
