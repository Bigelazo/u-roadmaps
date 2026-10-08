import 'server-only';
import { Prisma } from '@/shared/server/db';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import { reconcileRouteNotice } from '../application/reconcile-route';
import { storedRoutePayload, type RouteEffect } from '../application/route-effect';
import {
  recognitionSnapshot,
  acknowledgeCapturedNotice,
  reconcileRecognizedTarget,
} from './recognition-snapshot';

export async function reconcileStoredRoute(
  transaction: Prisma.TransactionClient,
  effect: RouteEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const payload = effect.payload;
  let currentValue: string;
  let titles: Record<string, string>;
  let visible: boolean;
  if (payload.routeTarget === 'dependency') {
    const nodes = await transaction.roadmapNode.findMany({
      where: {
        roadmapId: effect.roadmapId,
        id: { in: [String(payload.sourceNodeId), String(payload.targetNodeId)] },
      },
      select: { id: true, title: true, isVisible: true },
    });
    if (nodes.length !== 2) return;
    visible = nodes.every((node) => node.isVisible);
    const dependency = await transaction.dependency.findUnique({
      where: {
        sourceNodeId_targetNodeId: {
          sourceNodeId: String(payload.sourceNodeId),
          targetNodeId: String(payload.targetNodeId),
        },
      },
    });
    currentValue = String(!!dependency);
    titles = {
      prerequisiteNodeTitle: nodes.find(({ id }) => id === payload.sourceNodeId)!.title,
      dependentNodeTitle: nodes.find(({ id }) => id === payload.targetNodeId)!.title,
    };
  } else {
    const nodeType = await transaction.nodeType.findFirst({
      where: {
        id: String(payload.nodeTypeId),
        roadmapId: effect.roadmapId,
      },
      include: { nodes: { where: { isVisible: true }, select: { id: true } } },
    });
    if (!nodeType) return;
    visible = nodeType.nodes.length > 0;
    currentValue = nodeType.name;
    titles = { nextTypeName: nodeType.name };
  }
  const identity = {
    recipientId: effect.recipientId,
    roadmapId: effect.roadmapId,
    targetKey: payload.routeTargetKey,
  };
  const knowledge = await transaction.routeNoticeKnowledge.upsert({
    where: { recipientId_roadmapId_targetKey: identity },
    create: { ...identity, knownValue: payload.previousValue },
    update: {},
  });
  const pending = await transaction.roadmapNotice.findFirst({
    where: { ...identity, acknowledgedAt: null },
  });
  const changeKind = reconcileRouteNotice(knowledge.knownValue, currentValue, payload.routeTarget);
  if (!changeKind) {
    if (pending) await transaction.roadmapNotice.delete({ where: { id: pending.id } });
    return;
  }
  if (!visible) return;
  if (pending) {
    const previous = storedRoutePayload(pending.data);
    if (previous.knownValue === knowledge.knownValue && previous.currentValue === currentValue)
      return;
  }
  const occurredAt = new Date(
    Math.max(Date.parse(payload.occurredAt), pending?.occurredAt.getTime() ?? 0),
  );
  const subject =
    payload.routeTarget === 'dependency'
      ? 'Ruta actualizada'
      : `Tipo «${knowledge.knownValue}» → «${currentValue}»`;
  const body =
    payload.routeTarget === 'dependency'
      ? `«${titles.dependentNodeTitle}» ${currentValue === 'true' ? 'ahora requiere' : 'ya no requiere'} «${titles.prerequisiteNodeTitle}».`
      : `El tipo «${knowledge.knownValue}» ahora se llama «${currentValue}».`;
  const data = {
    ...payload,
    ...titles,
    ...(payload.routeTarget === 'type' ? { previousTypeName: knowledge.knownValue } : {}),
    noticeClass: effect.noticeClass,
    noticeTarget: payload.routeTarget === 'dependency' ? 'dependency' : 'node-type-name',
    changeKind,
    knownValue: knowledge.knownValue,
    currentValue,
    noticeTitle: subject,
    noticeBody: body,
    occurredAt: occurredAt.toISOString(),
  } as Prisma.InputJsonObject;
  const row = { subject, body, data, occurredAt, availableAt: occurredAt };
  if (pending) await transaction.roadmapNotice.update({ where: { id: pending.id }, data: row });
  else
    await transaction.roadmapNotice.create({
      data: {
        ...row,
        ...identity,
        eventId: effect.eventId,
        courseOfferingId: effect.courseOfferingId,
      },
    });
}

export function routeOpeningSnapshots(notices: readonly { id: string; data: Prisma.JsonValue }[]) {
  return notices.flatMap(({ id, data }) => {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      (data.noticeTarget !== 'dependency' && data.noticeTarget !== 'node-type-name')
    )
      return [];
    return [{ id, payload: storedRoutePayload(data) }];
  }) as Prisma.InputJsonArray;
}

/** Recognize a route value from either an independent or an absorbed snapshot. */
export async function recognizeRouteValue(
  transaction: Prisma.TransactionClient,
  effect: RouteEffect,
  knownValue: string,
  reconcileOnlyPending = false,
) {
  const identity = {
    recipientId: effect.recipientId,
    roadmapId: effect.roadmapId,
    targetKey: effect.payload.routeTargetKey,
  };
  const existing = await transaction.routeNoticeKnowledge.findUnique({
    where: { recipientId_roadmapId_targetKey: identity },
  });
  if (existing?.knownValue !== knownValue) {
    await transaction.routeNoticeKnowledge.upsert({
      where: { recipientId_roadmapId_targetKey: identity },
      create: { ...identity, knownValue },
      update: { knownValue },
    });
  }
  await reconcileRecognizedTarget(
    transaction,
    {
      recipientId: effect.recipientId,
      roadmapId: effect.roadmapId,
      targetKey: effect.payload.routeTargetKey,
    },
    reconcileOnlyPending,
    () => reconcileStoredRoute(transaction, effect),
  );
}

export async function recognizeRouteSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
  }: { recipientId: string; roadmapId: string; operationId: string; snapshots: Prisma.JsonValue },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid route opening snapshots.');
  let acknowledged = 0;
  for (const value of snapshots) {
    const snapshot = recognitionSnapshot(value);
    const payload = storedRoutePayload(snapshot.payload);
    acknowledged += await acknowledgeCapturedNotice(
      transaction,
      { id: snapshot.id, recipientId, roadmapId },
      (data) => storedRoutePayload(data).currentValue === payload.currentValue,
    );
    if (typeof payload.courseOfferingId !== 'string')
      throw new Error('Invalid route Course offering.');
    await recognizeRouteValue(
      transaction,
      {
        eventId: `recognition:${operationId}:${payload.routeTargetKey}`,
        recipientId,
        roadmapId,
        courseOfferingId: payload.courseOfferingId,
        noticeClass:
          payload.routeTarget === 'dependency'
            ? 'roadmap-path-changed'
            : 'roadmap-classification-changed',
        payload,
      },
      payload.currentValue,
    );
  }
  return acknowledged;
}
