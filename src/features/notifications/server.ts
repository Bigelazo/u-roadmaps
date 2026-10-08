import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@/shared/server/db';
import { studentNodeAccessById } from '@/features/roadmap/access';
import type { NodeChangeNotice, RoadmapAvailabilityNotice } from './contracts';
import {
  type NoticeDeliveryScheduler,
  listOwnNotices as listNotices,
  storeRoadmapAvailability,
  storeNodeChange,
  findOwnNotice,
  noticeRecord,
  countOwnNoticeTargets,
  countOwnNodeChanges,
  uuid,
  prepareOwnNoticeOpening as prepareNoticeOpening,
} from './infrastructure/own-inbox';
import { ApplicationError } from '@/shared/errors/server';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import { recordNoticeTargets, type NoticeDelivery } from './infrastructure/notice-lifecycle';
export { acknowledgeOwnNotices, reviewOwnNode } from './infrastructure/own-inbox';
export type { NoticeDelivery } from './infrastructure/notice-lifecycle';

/**
 * Notice lifecycle module (ADR-0024): record Known values inside the roadmap
 * transaction and return the deferred delivery of the change's notices.
 */
export function recordRoadmapNotices(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
): Promise<NoticeDelivery | undefined> {
  return recordNoticeTargets(transaction, changes, accessibleNodes);
}

export function listOwnNotices(userId: string, params: URLSearchParams) {
  return listNotices(userId, params);
}
export type { NoticeDeliveryScheduler } from './infrastructure/own-inbox';
export type InboxIdentity = Readonly<{ userId: string }>;

export function getInboxIdentity(userId: string): InboxIdentity {
  return { userId };
}

export async function getOwnNotice(userId: string, id: string) {
  return noticeRecord(await findOwnNotice(userId, id, accessibleNodes));
}

export function countOwnNotices(userId: string, params: URLSearchParams) {
  return countOwnNoticeTargets(userId, params);
}

export function countOwnNodeChangeTargets(userId: string, params: URLSearchParams) {
  return countOwnNodeChanges(userId, params);
}

type RecipientNode = Readonly<{
  id: string;
  roadmapId: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
}>;

async function eligibleNodeRecipients({
  node,
  courseOfferingId,
  actorId,
}: {
  node: RecipientNode;
  courseOfferingId: string;
  actorId: string;
}) {
  if (!node.isVisible) return [];
  const [participants, visibleNodes, dependencies] = await Promise.all([
    prisma.participation.findMany({
      where: { courseOfferingId, isActive: true, userId: { not: actorId } },
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
  return participants.flatMap((participant) => {
    if (participant.role === 'TEACHER') {
      return !node.isTeacherBlocked
        ? [{ userId: participant.user.id, name: participant.user.name }]
        : [];
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
}

export async function deliverRoadmapAvailability(
  notice: RoadmapAvailabilityNotice,
  scheduleDelivery?: NoticeDeliveryScheduler,
) {
  try {
    await storeRoadmapAvailability(notice, scheduleDelivery);
  } catch {
    console.warn('Roadmap availability delivery failed', { eventId: notice.eventId });
  }
}

export async function deliverNodeChange(
  input: {
    userId: string;
    courseCode: string;
    year: number;
    semester: number;
    nodeId: string;
    eventId?: string;
    changeKind: NodeChangeNotice['changeKind'];
    changedFields: NodeChangeNotice['changedFields'];
    nodeTitle?: string;
    previousAccess?: NodeChangeNotice['previousAccess'];
    nodeTypeName?: string;
    roadmapId?: string;
    recipientIds?: readonly string[];
    targetKind?: 'node' | 'roadmap';
  },
  scheduleDelivery?: NoticeDeliveryScheduler,
) {
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
  const offering = node?.roadmap.courseOffering;
  if (
    (offering &&
      (offering.courseCode !== input.courseCode ||
        offering.year !== input.year ||
        offering.semester !== input.semester)) ||
    (!node && (!input.recipientIds || !input.nodeTitle))
  )
    return;
  const offeringInfo =
    offering ??
    (await prisma.courseOffering.findUnique({
      where: {
        courseCode_year_semester: {
          courseCode: input.courseCode,
          year: input.year,
          semester: input.semester,
        },
      },
      include: { course: true },
    }));
  if (!offeringInfo) return;
  const roadmapId = input.roadmapId ?? node?.roadmapId;
  if (!roadmapId) return;
  const recipients = input.recipientIds
    ? await prisma.participation
        .findMany({
          where: {
            courseOfferingId: offeringInfo.id,
            isActive: true,
            userId: { in: [...input.recipientIds], not: input.userId },
          },
          include: { user: { select: { id: true, name: true } } },
        })
        .then((participants) =>
          participants.map(({ user }) => ({ userId: user.id, name: user.name })),
        )
    : node?.isVisible
      ? await eligibleNodeRecipients({
          node,
          courseOfferingId: offering!.id,
          actorId: input.userId,
        })
      : [];
  if (!recipients.length) return;

  const notice: NodeChangeNotice = {
    eventId: input.eventId ?? randomUUID(),
    roadmapId,
    courseOfferingId: offeringInfo.id,
    courseCode: offeringInfo.courseCode,
    year: offeringInfo.year,
    semester: offeringInfo.semester,
    courseName: offeringInfo.course.name,
    nodeId: input.nodeId,
    nodeTitle: input.nodeTitle ?? node!.title,
    changeKind: input.changeKind,
    changedFields: input.changedFields,
    ...(input.previousAccess
      ? { contentTarget: 'access' as const, previousValue: input.previousAccess }
      : {}),
    ...(input.nodeTypeName ? { nodeTypeName: input.nodeTypeName } : {}),
    ...(input.targetKind ? { targetKind: input.targetKind } : {}),
    actorId: input.userId,
    actorName:
      (await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }))
        ?.name ?? 'Equipo docente',
    occurredAt: new Date(),
    recipients,
  };

  await storeNodeChange(notice, scheduleDelivery).catch(() => {
    console.warn('Node notice delivery failed', { eventId: notice.eventId });
  });
}

async function accessibleNodes(
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) {
  const participation = await transaction.participation.findFirst({
    where: { userId, isActive: true, courseOffering: { roadmap: { id: roadmapId } } },
    select: { role: true },
  });
  if (!participation)
    throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
  const [nodes, dependencies, completions] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
    transaction.completion.findMany({
      where: { userId, roadmapNode: { roadmapId } },
      select: { roadmapNodeId: true },
    }),
  ]);
  if (participation.role === 'TEACHER')
    return new Set(nodes.filter((node) => !node.isTeacherBlocked).map((node) => node.id));
  const visible = new Set(nodes.map((node) => node.id));
  return new Set(
    [
      ...studentNodeAccessById({
        nodes,
        dependencies: dependencies.filter(
          (edge) => visible.has(edge.sourceNodeId) && visible.has(edge.targetNodeId),
        ),
        completedNodeIds: new Set(completions.map((completion) => completion.roadmapNodeId)),
      }),
    ]
      .filter(([, access]) => access.status === 'ACCESSIBLE')
      .map(([id]) => id),
  );
}

export function prepareOwnRoadmapOpening(userId: string, input: Record<string, unknown>) {
  if (input.nodeId !== undefined)
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'La apertura de un Nodo no reconoce avisos.',
    );
  const roadmapId = uuid(input.roadmapId);
  const operationId = uuid(input.operationId);
  return prepareNoticeOpening(
    userId,
    roadmapId,
    accessibleNodes,
    operationId,
    input.retry === true,
  ).then((operationId) => ({ roadmapId, operationId }));
}

export function prepareOwnNoticeOpening(userId: string, roadmapId: string) {
  return prepareNoticeOpening(userId, roadmapId, accessibleNodes);
}

export { openNotificationStream } from './infrastructure/sse';
