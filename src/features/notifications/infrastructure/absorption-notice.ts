import 'server-only';
import { Prisma } from '@/shared/server/db';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import type { NoticeEffect } from '../application/notice-effect';
import { reconcileAbsorption } from '../application/reconcile-absorption';

function noticeData(value: Prisma.JsonValue): Prisma.JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid notice data.');
  return value;
}

/** Returns true when a broad target has consumed the effect. */
export async function reconcileStoredAbsorption(
  transaction: Prisma.TransactionClient,
  effect: NoticeEffect,
) {
  await lockRecipientRoadmap(transaction, effect.recipientId, effect.roadmapId);
  const identity = {
    recipientId: effect.recipientId,
    roadmapId: effect.roadmapId,
    acknowledgedAt: null,
  };
  const availability = await transaction.roadmapNotice.findFirst({
    where: { ...identity, data: { path: ['changeKind'], equals: 'roadmap-available' } },
  });
  if (availability) {
    const occurredAt = new Date(
      Math.max(availability.occurredAt.getTime(), Date.parse(String(effect.payload.occurredAt))),
    );
    await transaction.roadmapNotice.deleteMany({
      where: { ...identity, id: { not: availability.id } },
    });
    await transaction.roadmapNotice.update({
      where: { id: availability.id },
      data: {
        occurredAt,
        availableAt: occurredAt,
        data: { ...noticeData(availability.data), occurredAt: occurredAt.toISOString() },
      },
    });
    return true;
  }
  if (effect.noticeClass === 'roadmap-available') {
    await transaction.roadmapNotice.deleteMany({ where: identity });
    return false;
  }
  const nodeId = effect.payload.nodeId;
  if (typeof nodeId !== 'string') return false;
  const lifecycle = await transaction.nodeLifecycleKnowledge.findUnique({
    where: {
      recipientId_roadmapId_nodeId: {
        recipientId: effect.recipientId,
        roadmapId: effect.roadmapId,
        nodeId,
      },
    },
  });
  const node = await transaction.roadmapNode.findUnique({
    where: { id: nodeId },
    include: { nodeType: true, resources: true },
  });
  const access = node
    ? await transaction.nodeContentKnowledge.findUnique({
        where: {
          recipientId_nodeId_target: { recipientId: effect.recipientId, nodeId, target: 'access' },
        },
      })
    : null;
  const state = !node
    ? 'deleted'
    : !node.isVisible
      ? 'Retirado'
      : access?.currentValue === 'Bloqueado' || node.isTeacherBlocked
        ? 'Bloqueado'
        : 'Disponible';
  const action = reconcileAbsorption({
    roadmapAvailable: false,
    newNode: lifecycle?.isKnown === false,
    nodeState: state,
  });
  // A delayed creation delivery must not reintroduce a Node already recognized on entry.
  if (
    lifecycle?.isKnown === true &&
    effect.payload.changeKind === 'node-available' &&
    effect.payload.contentTarget === undefined
  )
    return true;
  if (action === 'independent') return false;
  if (action === 'deletion' && effect.payload.changeKind !== 'node-deleted') return true;
  const scope = { ...identity, data: { path: ['nodeId'], equals: nodeId } };
  const pending = await transaction.roadmapNotice.findFirst({
    where: { ...scope, targetKey: `node:${nodeId}:creation` },
  });
  await transaction.roadmapNotice.deleteMany({
    where: { ...scope, ...(pending && action === 'creation' ? { id: { not: pending.id } } : {}) },
  });
  if (action === 'withdraw') return true;
  if (action === 'deletion') return false;
  if (!node) return true;
  const occurredAt = new Date(
    Math.max(Date.parse(String(effect.payload.occurredAt)), pending?.occurredAt.getTime() ?? 0),
  );
  const subject = `Nuevo Nodo «${node.title}»`;
  const body = `${subject}${state === 'Bloqueado' ? ' (Bloqueado)' : ''}.`;
  const data = {
    ...(pending ? noticeData(pending.data) : effect.payload),
    nodeId,
    nodeTitle: node.title,
    nodeDescription: state === 'Disponible' ? node.description : null,
    nodeTypeId: node.nodeTypeId,
    nodeTypeName: node.nodeType.name,
    resources: state === 'Disponible' ? node.resources.map(({ id, title }) => ({ id, title })) : [],
    nodeAccess: state,
    noticeTarget: 'node-creation',
    changeKind: 'node-available',
    noticeClass: 'roadmap-node-changed',
    targetKind: 'node',
    changedFields: [],
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
        eventId: effect.eventId,
        recipientId: effect.recipientId,
        roadmapId: effect.roadmapId,
        courseOfferingId: effect.courseOfferingId,
        targetKey: `node:${nodeId}:creation`,
      },
    });
  return true;
}
