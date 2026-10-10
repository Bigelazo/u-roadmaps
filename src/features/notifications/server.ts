import 'server-only';

import type { Prisma } from '@/shared/server/db';
import { studentNodeAccessById } from '@/features/roadmap/access';
import {
  listOwnNotices as listNotices,
  findOwnNotice,
  noticeRecord,
  countOwnNoticeTargets,
  countOwnNodeChanges,
  uuid,
  prepareOwnNoticeOpening as prepareNoticeOpening,
} from './infrastructure/own-inbox';
import { ApplicationError } from '@/shared/errors/server';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import {
  recordNoticeTargets,
  type NoticeDelivery,
  type NoticeDeliveryScheduler,
} from './infrastructure/notice-lifecycle';
import { acknowledgeOwnNotices as acknowledgeNotices } from './infrastructure/own-inbox';
export { reviewOwnNode } from './infrastructure/own-inbox';

/** Public types of the notice lifecycle module: a recorded change's deferred delivery and its scheduler. */
export type { NoticeDelivery, NoticeDeliveryScheduler };

export function acknowledgeOwnNotices(userId: string, input: Record<string, unknown>) {
  return acknowledgeNotices(userId, input, accessibleNodes);
}

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
