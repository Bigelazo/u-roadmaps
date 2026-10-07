import 'server-only';
import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import {
  nodeMessage,
  resourceMessage,
  roadmapClassificationChangeMessage,
  roadmapPathChangeMessage,
} from '../application/messages';
import { changeSummary } from '../application/change-summary';
import type { ChangeSummary } from '../contracts/change-summary';
import type { NoticeClass } from '../application/notice-effect';
import { deliverNotice } from './notice-delivery';
import {
  lockRecipientRoadmap,
  titleOpeningSnapshots,
  recognizeTitleSnapshots,
} from './title-notice';
import { resourceOpeningSnapshots, recognizeResourceSnapshots } from './resource-notice';
import { contentOpeningSnapshots, recognizeContentSnapshots } from './node-content-notice';
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

const deliveryFailureMessage: Record<NoticeClass, string> = {
  'roadmap-available': 'Roadmap availability delivery failed',
  'roadmap-node-changed': 'Node notice delivery failed',
  'roadmap-resource-changed': 'Resource notice delivery failed',
  'roadmap-path-changed': 'Roadmap path notice delivery failed',
  'roadmap-classification-changed': 'Roadmap classification notice delivery failed',
};
const DELIVERY_CONCURRENCY = 5;
const NOTICE_OPENING_RETENTION_MS = 24 * 60 * 60 * 1000;

async function pruneNoticeOpenings(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  openedAt: Date,
) {
  await transaction.noticeAcknowledgement.deleteMany({
    where: {
      recipientId,
      openedAt: { lt: new Date(openedAt.getTime() - NOTICE_OPENING_RETENTION_MS) },
    },
  });
}

export type NoticeDeliveryScheduler = (task: () => Promise<void>) => void | Promise<void>;

async function storeNotice(
  notice: Notice,
  noticeClass: NoticeClass,
  context: Record<string, unknown>,
  scheduleDelivery: NoticeDeliveryScheduler = after,
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
  // Only persistence runs after the response: audience and pedagogical context
  // above belong to the confirmed change, even if access changes immediately.
  const { eventId, roadmapId, courseOfferingId } = descriptor;
  await scheduleDelivery(async () => {
    try {
      // Bound recipient transactions without dropping later recipients on failure.
      let failed = false;
      for (let offset = 0; offset < participants.length; offset += DELIVERY_CONCURRENCY) {
        const results = await Promise.allSettled(
          participants.slice(offset, offset + DELIVERY_CONCURRENCY).map(({ userId }) =>
            deliverNotice({
              eventId,
              recipientId: userId,
              roadmapId,
              courseOfferingId,
              noticeClass,
              payload,
            }),
          ),
        );
        failed ||= results.some((result) => result.status === 'rejected');
      }
      if (failed) console.warn(deliveryFailureMessage[noticeClass], { eventId });
    } catch {
      console.warn(deliveryFailureMessage[noticeClass], { eventId });
    }
  });
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

export function storeNodeChange(
  notice: NodeChangeNotice,
  scheduleDelivery?: NoticeDeliveryScheduler,
) {
  return storeNotice(
    notice,
    'roadmap-node-changed',
    {
      ...nodeMessage(notice),
      targetKind: notice.targetKind ?? 'node',
    },
    scheduleDelivery,
  );
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

export function noticeRecord(notice: {
  id: string;
  subject: string;
  body: string;
  data: Prisma.JsonValue;
  availableAt: Date;
  acknowledgedAt: Date | null;
}) {
  return {
    id: notice.id,
    subject: notice.subject,
    body: notice.body,
    data: notice.data,
    createdAt: notice.availableAt.toISOString(),
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
    acknowledgedAt: null,
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
  operationId: string = randomUUID(),
  retry = false,
) {
  return prisma.$transaction(async (transaction) => {
    await lockRecipientRoadmap(transaction, userId, roadmapId);
    const existing = await transaction.noticeAcknowledgement.findUnique({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
    });
    if (existing) {
      await accessibleNodes(transaction, userId, roadmapId);
      if (existing.roadmapId !== roadmapId)
        throw new ApplicationError(400, 'INVALID_REQUEST', 'Apertura inválida.');
      return operationId;
    }
    if (retry) throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
    const [accessible, notices, nodes, roadmap] = await Promise.all([
      accessibleNodes(transaction, userId, roadmapId),
      transaction.roadmapNotice.findMany({
        where: { recipientId: userId, roadmapId, acknowledgedAt: null },
        select: { id: true, data: true },
        orderBy: [{ availableAt: 'desc' }, { id: 'desc' }],
      }),
      transaction.roadmapNode.findMany({
        where: { roadmapId },
        select: { id: true, title: true, isVisible: true },
      }),
      transaction.roadmap.findUniqueOrThrow({
        where: { id: roadmapId },
        select: { courseOffering: { select: { courseCode: true } } },
      }),
    ]);
    const openedAt = new Date();
    await pruneNoticeOpenings(transaction, userId, openedAt);
    const operation = await transaction.noticeAcknowledgement.create({
      data: {
        recipientId: userId,
        operationId,
        roadmapId,
        openedAt,
        noticeIds: notices.map(({ id }) => id),
        titleSnapshots: titleOpeningSnapshots(notices),
        contentSnapshots: contentOpeningSnapshots(notices),
        resourceSnapshots: resourceOpeningSnapshots(notices),
        summary: changeSummary(roadmap.courseOffering.courseCode, notices, nodes, accessible),
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
  const result = await prisma.$transaction(async (transaction) => {
    await lockRecipientRoadmap(transaction, userId, roadmapId);
    const retained = await transaction.noticeAcknowledgement.findUnique({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
    });
    if (!retained || retained.roadmapId !== roadmapId)
      throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
    // Recheck access on recognition, including retries after a roster change.
    const participation = await transaction.participation.findFirst({
      where: { userId, isActive: true, courseOffering: { roadmap: { id: roadmapId } } },
      select: { id: true },
    });
    if (!participation)
      throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
    if (retained.recognizedAt)
      return { count: 0, summary: retained.summary as ChangeSummary | null };
    const visited = await transaction.roadmapVisit.findUnique({
      where: { recipientId_roadmapId: { recipientId: userId, roadmapId } },
    });
    await transaction.roadmapVisit.upsert({
      where: { recipientId_roadmapId: { recipientId: userId, roadmapId } },
      create: { recipientId: userId, roadmapId },
      update: {},
    });
    const result = await transaction.roadmapNotice.updateMany({
      where: {
        recipientId: userId,
        roadmapId,
        acknowledgedAt: null,
        targetKey: null,
        id: { in: retained.noticeIds },
      },
      data: { acknowledgedAt: new Date() },
    });
    const resourceCount = await recognizeResourceSnapshots(transaction, {
      recipientId: userId,
      roadmapId,
      operationId,
      snapshots: retained.resourceSnapshots,
    });
    const contentCount = await recognizeContentSnapshots(transaction, {
      recipientId: userId,
      roadmapId,
      operationId,
      snapshots: retained.contentSnapshots,
    });
    const titleCount = await recognizeTitleSnapshots(transaction, {
      recipientId: userId,
      roadmapId,
      operationId,
      snapshots: retained.titleSnapshots,
    });
    const summary =
      visited && result.count + titleCount + contentCount + resourceCount > 0
        ? (retained.summary as ChangeSummary | null)
        : null;
    await transaction.noticeAcknowledgement.update({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
      data: { recognizedAt: new Date(), summary: summary ?? Prisma.JsonNull },
    });
    return {
      count: result.count + titleCount + contentCount + resourceCount,
      summary,
    };
  });
  return { acknowledged: result.count, summary: result.summary };
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
