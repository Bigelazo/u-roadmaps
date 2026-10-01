import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import { projectDigestNotification } from '../digest-projection';
import type { RoadmapAvailabilityNotice } from '../contracts';

export async function storeRoadmapAvailability(notice: RoadmapAvailabilityNotice) {
  const participants = await prisma.participation.findMany({
    where: {
      courseOfferingId: notice.courseOfferingId,
      isActive: true,
      userId: { in: notice.recipients.map(({ userId }) => userId), not: notice.actorId },
    },
    select: { userId: true },
  });
  const projection = projectDigestNotification(
    {
      ...notice,
      targetKind: 'roadmap',
      changeKind: 'roadmap-available',
      occurredAt: notice.occurredAt.toISOString(),
      eventCount: 1,
      digestKey: notice.eventId,
    },
    [],
  );
  await prisma.roadmapNotice.createMany({
    data: participants.map(({ userId }) => ({
      eventId: notice.eventId,
      recipientId: userId,
      roadmapId: notice.roadmapId,
      courseOfferingId: notice.courseOfferingId,
      occurredAt: notice.occurredAt,
      ...projection,
    })),
    skipDuplicates: true,
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
export async function prepareOwnNoticeOpening(userId: string, roadmapId: string) {
  return prisma.$transaction(async (transaction) => {
    const notices = await transaction.roadmapNotice.findMany({
      where: { recipientId: userId, roadmapId, acknowledgedAt: null },
      select: { id: true },
    });
    const operation = await transaction.noticeAcknowledgement.create({
      data: {
        recipientId: userId,
        operationId: randomUUID(),
        roadmapId,
        openedAt: new Date(),
        noticeIds: notices.map(({ id }) => id),
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
