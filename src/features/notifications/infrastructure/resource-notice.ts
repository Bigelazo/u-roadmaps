import 'server-only';
import { Prisma } from '@/shared/server/db';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import { reconcileResourceNotice } from '../application/reconcile-resource';
import {
  resourceNoticeState,
  storedResourcePayload,
  type ResourceNoticeEffect,
} from '../application/resource-effect';
import { recognitionSnapshot, acknowledgeCapturedNotice } from './recognition-snapshot';

export async function reconcileStoredResource(
  transaction: Prisma.TransactionClient,
  effect: ResourceNoticeEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const { nodeId, resourceId } = effect.payload;
  const node = await transaction.roadmapNode.findUnique({ where: { id: nodeId } });
  if (!node || !node.isVisible) return;
  const knowledge = await transaction.resourceNoticeKnowledge.upsert({
    where: { recipientId_resourceId: { recipientId: effect.recipientId, resourceId } },
    create: {
      recipientId: effect.recipientId,
      resourceId,
      nodeId,
      knownState:
        effect.payload.previousResource === null
          ? null
          : JSON.stringify(effect.payload.previousResource),
    },
    update: {},
  });
  const resource = await transaction.resource.findUnique({ where: { id: resourceId } });
  const currentResource = resource
    ? { title: resource.title, revision: resource.updatedAt.toISOString() }
    : null;
  const knownResource =
    knowledge.knownState === null ? null : resourceNoticeState(JSON.parse(knowledge.knownState));
  const targetKey = `resource:${resourceId}`;
  const pending = await transaction.roadmapNotice.findFirst({
    where: {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey,
      acknowledgedAt: null,
    },
  });
  const result = reconcileResourceNotice(knownResource, currentResource);
  if (!result) {
    if (pending) await transaction.roadmapNotice.delete({ where: { id: pending.id } });
    return;
  }
  const pendingData = pending ? storedResourcePayload(pending.data) : null;
  if (
    pendingData &&
    JSON.stringify(pendingData.currentResource) === JSON.stringify(currentResource) &&
    JSON.stringify(pendingData.knownResource) === JSON.stringify(knownResource)
  )
    return;
  const occurredAt = new Date(
    Math.max(Date.parse(effect.payload.occurredAt), pending?.occurredAt.getTime() ?? 0),
  );
  const body =
    result.changeKind === 'resource-added'
      ? `Nuevo recurso «${result.resourceTitle}» en «${node.title}».`
      : result.changeKind === 'resource-removed'
        ? `Se eliminó el recurso «${result.resourceTitle}» de «${node.title}».`
        : `Se actualizó el recurso «${result.resourceTitle}» en «${node.title}».${result.titleChange ? ` ${result.titleChange}` : ''}`;
  const data = {
    ...effect.payload,
    ...result,
    noticeClass: effect.noticeClass,
    noticeTarget: 'resource',
    nodeTitle: node.title,
    knownResource,
    currentResource,
    occurredAt: occurredAt.toISOString(),
    noticeTitle: result.resourceTitle,
    noticeBody: body,
  } as Prisma.InputJsonObject;
  const row = { subject: result.resourceTitle, body, data, occurredAt, availableAt: occurredAt };
  if (pending) await transaction.roadmapNotice.update({ where: { id: pending.id }, data: row });
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

export function resourceOpeningSnapshots(
  notices: readonly { id: string; data: Prisma.JsonValue }[],
) {
  return notices.flatMap(({ id, data }) => {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.noticeTarget !== 'resource'
    )
      return [];
    return [{ id, payload: storedResourcePayload(data) }];
  }) as Prisma.InputJsonArray;
}

export async function recognizeResourceSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
  }: {
    recipientId: string;
    roadmapId: string;
    operationId: string;
    snapshots: Prisma.JsonValue;
  },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid Resource opening snapshots.');
  let acknowledged = 0;
  for (const value of snapshots) {
    const snapshot = recognitionSnapshot(value);
    const payload = storedResourcePayload(snapshot.payload);
    const known = await transaction.resourceNoticeKnowledge.updateMany({
      where: { recipientId, resourceId: payload.resourceId },
      data: {
        knownState:
          payload.currentResource === null ? null : JSON.stringify(payload.currentResource),
      },
    });
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) =>
        JSON.stringify(storedResourcePayload(data).currentResource) ===
        JSON.stringify(payload.currentResource),
    );
    if (!known.count) continue;
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid Resource Course offering.');
    await reconcileStoredResource(transaction, {
      eventId: `recognition:${operationId}:${payload.resourceId}`,
      recipientId,
      roadmapId,
      courseOfferingId: payload.courseOfferingId,
      noticeClass: 'roadmap-resource-changed',
      payload,
    });
  }
  return acknowledged;
}
