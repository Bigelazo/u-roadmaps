import 'server-only';
import { recognitionSnapshot, acknowledgeCapturedNotice } from './recognition-snapshot';
import { Prisma } from '@/shared/server/db';
import { storedTitlePayload, type TitleNoticeEffect } from '../application/title-effect';
import { reconcileTitleNotice } from '../application/reconcile-title';

/** Delivery and recognition serialize at the recipient/Roadmap boundary. */
export async function lockRecipientRoadmap(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${recipientId}:${roadmapId}`}, 0))`;
}

export async function reconcileStoredTitle(
  transaction: Prisma.TransactionClient,
  effect: TitleNoticeEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const nodeId = effect.payload.nodeId;
  const node = await transaction.roadmapNode.findUnique({ where: { id: nodeId } });
  if (!node || !node.isVisible) return;
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
    const known = await transaction.nodeTitleKnowledge.updateMany({
      where: { recipientId, nodeId: payload.nodeId },
      data: { knownTitle: payload.currentTitle },
    });
    if (!known.count) continue; // The Node may have been deleted since opening.
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) => storedTitlePayload(data).currentTitle === payload.currentTitle,
    );
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid title Course offering.');
    await reconcileStoredTitle(transaction, {
      eventId: `recognition:${operationId}:${payload.nodeId}`,
      recipientId,
      roadmapId,
      courseOfferingId: payload.courseOfferingId,
      noticeClass: 'roadmap-node-changed',
      payload,
    });
  }
  return acknowledged;
}
