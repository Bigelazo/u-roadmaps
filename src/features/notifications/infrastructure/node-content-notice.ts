import { accessNoticeDestination, nodeAccessChangeText } from '@/shared/node-access';
import 'server-only';
import {
  recognitionSnapshot,
  acknowledgeCapturedNotice,
  reconcileRecognizedTarget,
} from './recognition-snapshot';
import { Prisma } from '@/shared/server/db';
import {
  storedNodeContentPayload,
  type NodeContentEffect,
} from '../application/node-content-effect';
import { reconcileNodeContentNotice } from '../application/reconcile-node-content';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';

export async function reconcileStoredNodeContent(
  transaction: Prisma.TransactionClient,
  effect: NodeContentEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const { nodeId, contentTarget } = effect.payload;
  const node = await transaction.roadmapNode.findUnique({ where: { id: nodeId } });
  if (!node) return;
  const knowledge = await transaction.nodeContentKnowledge.upsert({
    where: {
      recipientId_nodeId_target: { recipientId: effect.recipientId, nodeId, target: contentTarget },
    },
    create: {
      recipientId: effect.recipientId,
      nodeId,
      target: contentTarget,
      knownValue: effect.payload.previousValue,
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
  const currentValue = knowledge.currentValue ?? effect.payload.previousValue;
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
  const data = {
    ...effect.payload,
    noticeClass: effect.noticeClass,
    noticeTarget: 'node-access',
    ...accessNoticeDestination(currentValue),
    nodeTitle: node.title,
    knownValue: result.knownValue,
    currentValue: result.currentValue,
    occurredAt: occurredAt.toISOString(),
    changedFields: [contentTarget],
  } as Prisma.InputJsonObject;
  const row = {
    subject: node.title,
    body: nodeAccessChangeText(node.title, result.knownValue, result.currentValue),
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
      data.noticeTarget !== 'node-access'
    )
      return [];
    return [{ id, payload: storedNodeContentPayload(data) }];
  }) as Prisma.InputJsonArray;
}

/** All entry paths establish content knowledge and rebase through this operation. */
export async function recognizeNodeContentValue(
  transaction: Prisma.TransactionClient,
  effect: NodeContentEffect,
  knownValue: string,
  reconcileOnlyPending = false,
) {
  const { nodeId, contentTarget: target } = effect.payload;
  const node = await transaction.roadmapNode.findUnique({ where: { id: nodeId } });
  if (!node) return;
  const identity = { recipientId: effect.recipientId, nodeId, target };
  const existing = await transaction.nodeContentKnowledge.findUnique({
    where: { recipientId_nodeId_target: identity },
  });
  if (!existing || existing.knownValue !== knownValue) {
    await transaction.nodeContentKnowledge.upsert({
      where: { recipientId_nodeId_target: identity },
      create: {
        ...identity,
        knownValue,
        currentValue: !node.isVisible
          ? 'Retirado'
          : node.isTeacherBlocked
            ? 'Bloqueado'
            : knownValue,
      },
      update: { knownValue },
    });
  }
  await reconcileRecognizedTarget(
    transaction,
    {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey: `node:${nodeId}:${target}`,
    },
    reconcileOnlyPending,
    () => reconcileStoredNodeContent(transaction, effect),
  );
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
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) => storedNodeContentPayload(data).currentValue === payload.currentValue,
    );
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid content Course offering.');
    await recognizeNodeContentValue(
      transaction,
      {
        eventId: `recognition:${operationId}:${payload.nodeId}:${payload.contentTarget}`,
        recipientId,
        roadmapId,
        courseOfferingId: payload.courseOfferingId,
        noticeClass: 'roadmap-node-changed',
        payload,
      },
      payload.currentValue,
    );
  }
  return acknowledged;
}
