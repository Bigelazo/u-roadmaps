import 'server-only';
import { recognitionSnapshot, acknowledgeCapturedNotice } from './recognition-snapshot';
import { Prisma } from '@/shared/server/db';
import {
  storedNodeContentPayload,
  type NodeContentEffect,
} from '../application/node-content-effect';
import { reconcileNodeContentNotice } from '../application/reconcile-node-content';
import { lockRecipientRoadmap } from './title-notice';

export async function reconcileStoredNodeContent(
  transaction: Prisma.TransactionClient,
  effect: NodeContentEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const { nodeId, contentTarget } = effect.payload;
  const node = await transaction.roadmapNode.findUnique({
    where: { id: nodeId },
    include: { nodeType: true },
  });
  if (!node || !node.isVisible) return;
  const knowledge = await transaction.nodeContentKnowledge.upsert({
    where: {
      recipientId_nodeId_target: { recipientId: effect.recipientId, nodeId, target: contentTarget },
    },
    create: {
      recipientId: effect.recipientId,
      nodeId,
      target: contentTarget,
      knownValue: effect.payload.previousValue,
      knownTypeName: effect.payload.previousTypeName,
      currentTypeName: effect.payload.currentTypeName,
    },
    update: {},
  });
  const targetKey = `node:${nodeId}:${contentTarget}`;
  const pending = await transaction.roadmapNotice.findFirst({
    where: {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey,
      acknowledgedAt: null,
    },
  });
  const pendingData = pending ? storedNodeContentPayload(pending.data) : null;
  const currentValue =
    contentTarget === 'description' ? JSON.stringify(node.description) : node.nodeTypeId;
  const result = reconcileNodeContentNotice({
    knownValue: knowledge.knownValue,
    pendingValue: pendingData?.currentValue ?? null,
    pendingKnownValue: pendingData?.knownValue ?? null,
    currentValue,
  });
  if (result.action === 'no-op') return;
  if (result.action === 'withdraw') {
    await transaction.roadmapNotice.delete({ where: { id: pending!.id } });
    return;
  }
  const occurredAt = new Date(
    Math.max(Date.parse(effect.payload.occurredAt), pending?.occurredAt.getTime() ?? 0),
  );
  // Preserve the name captured by the assignment, even if the type was renamed.
  const currentTypeName =
    pendingData?.currentValue === currentValue
      ? pendingData.currentTypeName
      : (knowledge.currentTypeName ?? effect.payload.currentTypeName);
  const data = {
    ...effect.payload,
    noticeClass: effect.noticeClass,
    noticeTarget: contentTarget === 'description' ? 'node-description' : 'node-type',
    nodeTitle: node.title,
    knownValue: result.knownValue,
    currentValue: result.currentValue,
    ...(contentTarget === 'nodeType'
      ? { knownTypeName: knowledge.knownTypeName, currentTypeName }
      : {}),
    occurredAt: occurredAt.toISOString(),
    changedFields: [contentTarget],
  } as Prisma.InputJsonObject;
  const row = {
    subject: node.title,
    body:
      contentTarget === 'description'
        ? `Se actualizó la descripción de «${node.title}».`
        : `«${node.title}» pasó de tipo «${knowledge.knownTypeName}» a tipo «${currentTypeName}».`,
    data,
    occurredAt,
    availableAt: occurredAt,
  };
  if (result.action === 'update')
    await transaction.roadmapNotice.update({ where: { id: pending!.id }, data: row });
  else
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

export function contentOpeningSnapshots(
  notices: readonly { id: string; data: Prisma.JsonValue }[],
) {
  return notices.flatMap(({ id, data }) => {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      (data.noticeTarget !== 'node-description' && data.noticeTarget !== 'node-type')
    )
      return [];
    return [{ id, payload: storedNodeContentPayload(data) }];
  }) as Prisma.InputJsonArray;
}

export async function recognizeContentSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
  }: { recipientId: string; roadmapId: string; operationId: string; snapshots: Prisma.JsonValue },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid content opening snapshots.');
  let acknowledged = 0;
  for (const value of snapshots) {
    const snapshot = recognitionSnapshot(value);
    const payload = storedNodeContentPayload(snapshot.payload);
    const known = await transaction.nodeContentKnowledge.updateMany({
      where: { recipientId, nodeId: payload.nodeId, target: payload.contentTarget },
      data: { knownValue: payload.currentValue, knownTypeName: payload.currentTypeName },
    });
    if (!known.count) continue;
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) => storedNodeContentPayload(data).currentValue === payload.currentValue,
    );
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid content Course offering.');
    await reconcileStoredNodeContent(transaction, {
      eventId: `recognition:${operationId}:${payload.nodeId}:${payload.contentTarget}`,
      recipientId,
      roadmapId,
      courseOfferingId: payload.courseOfferingId,
      noticeClass: 'roadmap-node-changed',
      payload,
    });
  }
  return acknowledged;
}
