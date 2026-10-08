import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import 'server-only';
import {
  recognitionSnapshot,
  acknowledgeCapturedNotice,
  reconcileRecognizedTarget,
} from './recognition-snapshot';
import { Prisma } from '@/shared/server/db';
import { storedTitlePayload, type TitleNoticeEffect } from '../application/title-effect';
import { reconcileTitleNotice } from '../application/reconcile-title';

export { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';

export async function reconcileStoredTitle(
  transaction: Prisma.TransactionClient,
  effect: TitleNoticeEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const nodeId = effect.payload.nodeId;
  const node = await transaction.roadmapNode.findUnique({ where: { id: nodeId } });
  if (!node) return;
  const knowledge = await transaction.nodeTitleKnowledge.upsert({
    where: { recipientId_nodeId: { recipientId: effect.recipientId, nodeId } },
    create: {
      recipientId: effect.recipientId,
      nodeId,
      knownTitle: effect.payload.previousTitle,
    },
    update: {},
  });
  const targetKey = `node:${nodeId}:title`;
  const pending = await transaction.roadmapNotice.findFirst({
    where: {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey,
      acknowledgedAt: null,
    },
  });
  const pendingData = pending ? storedTitlePayload(pending.data) : null;
  const result = reconcileTitleNotice({
    knownTitle: knowledge.knownTitle,
    pendingTitle: pendingData?.currentTitle ?? null,
    pendingKnownTitle: pendingData?.knownTitle ?? null,
    currentTitle: node.title,
  });
  if (result.action === 'no-op') return;
  if (result.action === 'withdraw') {
    await transaction.roadmapNotice.delete({ where: { id: pending!.id } });
    return;
  }
  if (!node.isVisible) return;
  const occurredAt = new Date(
    Math.max(Date.parse(effect.payload.occurredAt), pending?.occurredAt.getTime() ?? 0),
  );
  const data = {
    ...effect.payload,
    noticeClass: effect.noticeClass,
    occurredAt: occurredAt.toISOString(),
    noticeTarget: 'node-title',
    nodeTitle: result.currentTitle,
    knownTitle: result.knownTitle,
    currentTitle: result.currentTitle,
    changedFields: ['title'],
  } as Prisma.InputJsonObject;
  const row = {
    subject: result.currentTitle,
    body: `«${result.knownTitle}» pasó a llamarse «${result.currentTitle}».`,
    data,
    occurredAt,
    availableAt: occurredAt,
  };
  if (result.action === 'update') {
    await transaction.roadmapNotice.update({ where: { id: pending!.id }, data: row });
  } else {
    await transaction.roadmapNotice.create({
      data: {
        ...row,
        targetKey,
        eventId: effect.eventId,
        recipientId: effect.recipientId,
        roadmapId: effect.roadmapId,
        courseOfferingId: effect.courseOfferingId,
      },
    });
  }
}

export function titleOpeningSnapshots(notices: readonly { id: string; data: Prisma.JsonValue }[]) {
  return notices.flatMap((notice) => {
    const data = notice.data;
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.noticeTarget !== 'node-title'
    )
      return [];
    return [{ id: notice.id, payload: storedTitlePayload(data) }];
  }) as Prisma.InputJsonArray;
}

/** Advance the captured baseline and rebase later edits for either kind of entry snapshot. */
export async function recognizeTitleValue(
  transaction: Prisma.TransactionClient,
  effect: TitleNoticeEffect,
  knownTitle: string,
  reconcileOnlyPending = false,
) {
  const nodeId = effect.payload.nodeId;
  if (!(await transaction.roadmapNode.findUnique({ where: { id: nodeId }, select: { id: true } })))
    return;
  const identity = { recipientId: effect.recipientId, nodeId };
  const existing = await transaction.nodeTitleKnowledge.findUnique({
    where: { recipientId_nodeId: identity },
  });
  if (existing?.knownTitle !== knownTitle) {
    await transaction.nodeTitleKnowledge.upsert({
      where: { recipientId_nodeId: identity },
      create: { ...identity, knownTitle },
      update: { knownTitle },
    });
  }
  await reconcileRecognizedTarget(
    transaction,
    {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey: `node:${nodeId}:title`,
    },
    reconcileOnlyPending,
    () => reconcileStoredTitle(transaction, effect),
  );
}

/** Recognize captured values once, rebasing any later delivery onto those values. */
export async function recognizeTitleSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
  }: { recipientId: string; roadmapId: string; operationId: string; snapshots: Prisma.JsonValue },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid title opening snapshots.');
  let acknowledged = 0;
  for (const value of snapshots) {
    const snapshot = recognitionSnapshot(value);
    const payload = storedTitlePayload(snapshot.payload);
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) => storedTitlePayload(data).currentTitle === payload.currentTitle,
    );
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid title Course offering.');
    await recognizeTitleValue(
      transaction,
      {
        eventId: `recognition:${operationId}:${payload.nodeId}`,
        recipientId,
        roadmapId,
        courseOfferingId: payload.courseOfferingId,
        noticeClass: 'roadmap-node-changed',
        payload,
      },
      payload.currentTitle,
    );
  }
  return acknowledged;
}
