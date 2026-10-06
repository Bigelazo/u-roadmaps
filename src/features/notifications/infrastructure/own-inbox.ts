import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import {
  nodeMessage,
  resourceMessage,
  roadmapClassificationChangeMessage,
  roadmapPathChangeMessage,
} from '../application/messages';
import type { NoticeClass } from '../application/notice-effect';
import { deliverNotice } from './notice-delivery';
import type {
  NodeChangeNotice,
  RoadmapClassificationChangeNotice,
  RoadmapAvailabilityNotice,
  RoadmapPathChangeNotice,
  ResourceChangeNotice,
} from '../contracts';

type Notice =
  | RoadmapAvailabilityNotice
  | NodeChangeNotice
  | ResourceChangeNotice
  | RoadmapPathChangeNotice
  | RoadmapClassificationChangeNotice;

const DELIVERY_CONCURRENCY = 5;

async function storeNotice(
  notice: Notice,
  noticeClass: NoticeClass,
  context: Record<string, unknown>,
) {
  const { recipients, ...descriptor } = notice;
  const participants = await prisma.participation.findMany({
    where: {
      courseOfferingId: notice.courseOfferingId,
      isActive: true,
      userId: { in: recipients.map(({ userId }) => userId), not: notice.actorId },
    },
    select: { userId: true },
  });
  const payload = {
    ...descriptor,
    ...context,
    occurredAt: notice.occurredAt.toISOString(),
    eventCount: 1,
    digestKey: notice.eventId,
  };
  // Each recipient opens an interactive transaction. Bounding them keeps large Courses
  // from exhausting the Prisma pool; every recipient is attempted before reporting failure.
  let failure: { error: unknown } | undefined;
  for (let offset = 0; offset < participants.length; offset += DELIVERY_CONCURRENCY) {
    const results = await Promise.allSettled(
      participants.slice(offset, offset + DELIVERY_CONCURRENCY).map(({ userId }) =>
        deliverNotice({
          eventId: notice.eventId,
          recipientId: userId,
          roadmapId: notice.roadmapId,
          courseOfferingId: notice.courseOfferingId,
          noticeClass,
          payload,
        }),
      ),
    );
    for (const result of results)
      if (result.status === 'rejected') failure ??= { error: result.reason };
  }
  if (failure) throw failure.error;
}

export function storeRoadmapAvailability(notice: RoadmapAvailabilityNotice) {
  return storeNotice(notice, 'roadmap-available', {
    targetKind: 'roadmap',
    changeKind: 'roadmap-available',
  });
}

export function storeRoadmapPathChange(notice: RoadmapPathChangeNotice) {
  return storeNotice(notice, 'roadmap-path-changed', {
    ...roadmapPathChangeMessage(notice),
    targetKind: 'roadmap',
  });
}

export function storeRoadmapClassificationChange(notice: RoadmapClassificationChangeNotice) {
  return storeNotice(notice, 'roadmap-classification-changed', {
    ...roadmapClassificationChangeMessage(notice),
    targetKind: 'roadmap',
    changeKind: 'classification-updated',
  });
}

export function storeNodeChange(notice: NodeChangeNotice) {
  return storeNotice(notice, 'roadmap-node-changed', {
    ...nodeMessage(notice),
    targetKind: notice.targetKind ?? 'node',
  });
}

export function storeResourceChange(notice: ResourceChangeNotice) {
  return storeNotice(notice, 'roadmap-resource-changed', {
    ...resourceMessage(notice),
    targetKind: 'node',
  });
}

export type NoticeNodeAccess = (
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) => Promise<ReadonlySet<string>>;

export async function prepareOwnNodeOpening(
  userId: string,
  input: Record<string, unknown>,
  accessibleNodes: NoticeNodeAccess,
) {
  const roadmapId = uuid(input.roadmapId);
  const nodeId = uuid(input.nodeId);
  const operationId = uuid(input.operationId);
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.noticeAcknowledgement.findUnique({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
    });
    if (existing) {
      if (existing.roadmapId !== roadmapId)
        throw new ApplicationError(400, 'INVALID_REQUEST', 'Apertura inválida.');
      return { roadmapId, operationId };
    }
    if (input.retry === true) {
      throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Nodo no encontrada.');
    }
    const accessible = await accessibleNodes(transaction, userId, roadmapId);
    if (!accessible.has(nodeId))
      throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Nodo.');
    const notices = await transaction.roadmapNotice.findMany({
      where: {
        recipientId: userId,
        roadmapId,
        acknowledgedAt: null,
        data: { path: ['nodeId'], equals: nodeId },
      },
      select: { id: true },
    });
    await transaction.noticeAcknowledgement.upsert({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
      update: {},
      create: {
        recipientId: userId,
        operationId,
        roadmapId,
        openedAt: new Date(),
        noticeIds: notices.map(({ id }) => id),
      },
    });
    return { roadmapId, operationId };
  });
}

export function noticeRecord(notice: {
  id: string;
  subject: string;
  body: string;
  data: Prisma.JsonValue;
  availableAt: Date;
  seenAt: Date | null;
  acknowledgedAt: Date | null;
}) {
  return {
    id: notice.id,
    subject: notice.subject,
    body: notice.body,
    data: notice.data,
    createdAt: notice.availableAt.toISOString(),
    seen: notice.seenAt !== null,
    read: notice.acknowledgedAt !== null,
  };
}

export function noticeFilter(params: URLSearchParams): Prisma.RoadmapNoticeWhereInput {
  const roadmapId = params.get('roadmapId');
  const courseCode = params.get('courseCode');
  const year = params.get('year');
  const semester = params.get('semester');
  const nodeId = params.get('nodeId');
  if (
    (year && !Number.isSafeInteger(Number(year))) ||
    (semester && !['1', '2'].includes(semester))
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Filtro de Curso inválido.');
  }
  return {
    ...(roadmapId ? { roadmapId: uuid(roadmapId) } : {}),
    ...(nodeId ? { data: { path: ['nodeId'], equals: nodeId } } : {}),
    AND: [
      ...(courseCode ? [{ data: { path: ['courseCode'], equals: courseCode } }] : []),
      ...(year ? [{ data: { path: ['year'], equals: Number(year) } }] : []),
      ...(semester ? [{ data: { path: ['semester'], equals: Number(semester) } }] : []),
    ],
    ...(params.get('read') === 'false' ? { acknowledgedAt: null } : {}),
  };
}

export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Identidad de aviso inválida.');
  }
  return value;
}

export async function listOwnNotices(userId: string, params: URLSearchParams) {
  const limit = Number(params.get('limit') ?? 10);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Límite inválido.');
  }
  const after = params.get('after');
  const cursor = after
    ? await prisma.roadmapNotice.findFirst({
        where: { id: uuid(after), recipientId: userId },
      })
    : null;
  if (after && !cursor) throw new ApplicationError(404, 'NOT_FOUND', 'Aviso no encontrado.');
  const notifications = await prisma.roadmapNotice.findMany({
    where: {
      ...noticeFilter(params),
      recipientId: userId,
      ...(cursor
        ? {
            OR: [
              { availableAt: { lt: cursor.availableAt } },
              { availableAt: cursor.availableAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ availableAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  return {
    notifications: notifications.slice(0, limit).map(noticeRecord),
    hasMore: notifications.length > limit,
  };
}

export async function findOwnNotice(userId: string, id: string) {
  const notice = await prisma.roadmapNotice.findFirst({
    where: { id: uuid(id), recipientId: userId },
  });
  if (!notice) throw new ApplicationError(404, 'NOT_FOUND', 'Aviso no encontrado.');
  return notice;
}

// Capture committed, visible identities on the server when the Roadmap opens.
// Retrying recognition can never expand this set, even if delivery committed later.
export async function prepareOwnNoticeOpening(
  userId: string,
  roadmapId: string,
  accessibleNodes: NoticeNodeAccess,
) {
  return prisma.$transaction(async (transaction) => {
    const [accessible, notices] = await Promise.all([
      accessibleNodes(transaction, userId, roadmapId),
      transaction.roadmapNotice.findMany({
        where: { recipientId: userId, roadmapId, acknowledgedAt: null },
        select: { id: true, data: true },
      }),
    ]);
    const generalNotices = notices.filter(({ data }) => {
      const context = data as Record<string, unknown>;
      return (
        context.targetKind !== 'node' ||
        typeof context.nodeId !== 'string' ||
        !accessible.has(context.nodeId)
      );
    });
    const operation = await transaction.noticeAcknowledgement.create({
      data: {
        recipientId: userId,
        operationId: randomUUID(),
        roadmapId,
        openedAt: new Date(),
        noticeIds: generalNotices.map(({ id }) => id),
      },
    });
    return operation.operationId;
  });
}

export async function acknowledgeOwnNotices(userId: string, input: Record<string, unknown>) {
  const operationId = uuid(input.operationId);
  const roadmapId = uuid(input.roadmapId);
  const operation = await prisma.noticeAcknowledgement.findUnique({
    where: { recipientId_operationId: { recipientId: userId, operationId } },
  });
  if (!operation || operation.roadmapId !== roadmapId) {
    throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
  }
  const result = await prisma.roadmapNotice.updateMany({
    where: {
      recipientId: userId,
      roadmapId,
      acknowledgedAt: null,
      id: { in: operation.noticeIds },
    },
    data: { acknowledgedAt: new Date() },
  });
  return { acknowledged: result.count };
}

export async function countOwnNoticesByNode(userId: string, params: URLSearchParams) {
  const roadmapId = uuid(params.get('roadmapId'));
  const rows = await prisma.$queryRaw<{ nodeId: string | null; count: bigint }[]>(Prisma.sql`
    SELECT data->>'nodeId' AS "nodeId", COUNT(*) AS count
    FROM "RoadmapNotice"
    WHERE "recipientId" = ${userId}::uuid
      AND "roadmapId" = ${roadmapId}::uuid
      AND "acknowledgedAt" IS NULL
    GROUP BY data->>'nodeId'
  `);
  return {
    count: rows.reduce((total, row) => total + Number(row.count), 0),
    byNode: Object.fromEntries(
      rows.filter((row) => row.nodeId !== null).map((row) => [row.nodeId, Number(row.count)]),
    ) as Record<string, number>,
  };
}
