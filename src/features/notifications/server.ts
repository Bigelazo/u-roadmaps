import 'server-only';

import type { Prisma } from '@/shared/server/db';
import { readParticipantAccess } from '@/features/roadmap/access';
import {
  acknowledgeOwnNotices as acknowledgeNotices,
  countOwnNodeChanges,
  countOwnNoticeTargets,
  findOwnNotice,
  listOwnNotices as listNotices,
  noticeRecord,
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
export { reviewOwnNode } from './infrastructure/own-inbox';

/** Public types of the notice lifecycle module: a recorded change's deferred delivery and its scheduler. */
export type { NoticeDelivery, NoticeDeliveryScheduler };

// The Inbox, its counts and Node change marks receive Node access from the participant view.
export function listOwnNotices(userId: string, params: URLSearchParams) {
  return listNotices(userId, params, readParticipantAccess);
}

export function countOwnNotices(userId: string, params: URLSearchParams) {
  return countOwnNoticeTargets(userId, params, readParticipantAccess);
}

export function countOwnNodeChangeTargets(userId: string, params: URLSearchParams) {
  return countOwnNodeChanges(userId, params, readParticipantAccess);
}

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

export type InboxIdentity = Readonly<{ userId: string }>;

export function getInboxIdentity(userId: string): InboxIdentity {
  return { userId };
}

export async function getOwnNotice(userId: string, id: string) {
  return noticeRecord(await findOwnNotice(userId, id, accessibleNodes));
}

/** One Roadmap's accessible Nodes, from the participant view; no active Participation is 403. */
async function accessibleNodes(
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) {
  const access = await readParticipantAccess(transaction, { userId, roadmapIds: [roadmapId] });
  const accessible = access.get(roadmapId);
  if (!accessible) throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
  return accessible;
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

export { openNotificationStream } from './infrastructure/sse';
