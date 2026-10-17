import 'server-only';
import { lockNoticeParticipation } from './participation-lock';
import { isOwnNoticeVisible } from './notice-visibility';
import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import {
  queryInboxPage,
  queryInboxCounts,
  queryNodeChangeCounts,
  type InboxFilter,
  type InboxRecipient,
} from './inbox-query';
import { changeSummary } from '../application/change-summary';
import type { ChangeSummary } from '../contracts/change-summary';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import {
  entryTargetSnapshots,
  recognizeTargetSnapshots,
  roadmapNodeAccess,
  type ParticipantAccessReader,
} from './notice-lifecycle';
import { projectTargetNotice } from '../application/notice-targets';

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

export function noticeRecord(notice: {
  id: string;
  courseName?: string;
  subject: string;
  body: string;
  data: Prisma.JsonValue;
  availableAt: Date;
  acknowledgedAt: Date | null;
}) {
  // Lifecycle notices are worded at read time; other rows keep their stored text.
  const projected = projectTargetNotice(notice.data);
  return {
    id: notice.id,
    // Rows are titled by the Course so the reader knows which Roadmap changed.
    ...(notice.courseName ? { courseName: notice.courseName } : {}),
    subject: projected?.wording.subject ?? notice.subject,
    body: projected?.wording.body ?? notice.body,
    data: projected?.data ?? notice.data,
    createdAt: notice.availableAt.toISOString(),
    read: notice.acknowledgedAt !== null,
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

function inboxFilter(params: URLSearchParams): InboxFilter {
  const year = params.get('year');
  const semester = params.get('semester');
  if (
    (year && !Number.isSafeInteger(Number(year))) ||
    (semester && !['1', '2'].includes(semester))
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Filtro de Curso inválido.');
  }
  return {
    ...(params.get('roadmapId') ? { roadmapId: uuid(params.get('roadmapId')) } : {}),
    ...(params.get('nodeId') ? { nodeId: params.get('nodeId')! } : {}),
    ...(params.get('courseCode') ? { courseCode: params.get('courseCode')! } : {}),
    ...(year ? { year: Number(year) } : {}),
    ...(semester ? { semester: Number(semester) } : {}),
  };
}

/** The recipient's accessible Nodes in the filtered Roadmap, or in every Roadmap of theirs. */
async function inboxRecipient(
  userId: string,
  roadmapId: string | undefined,
  readAccess: ParticipantAccessReader,
): Promise<InboxRecipient> {
  const roadmapIds = roadmapId
    ? [roadmapId]
    : (
        await prisma.roadmap.findMany({
          where: { courseOffering: { participants: { some: { userId, isActive: true } } } },
          select: { id: true },
        })
      ).map(({ id }) => id);
  const access = await readAccess(prisma, { userId, roadmapIds });
  return { userId, accessibleNodeIds: [...access.values()].flatMap((ids) => [...ids]) };
}

export async function listOwnNotices(
  userId: string,
  params: URLSearchParams,
  readAccess: ParticipantAccessReader,
) {
  const limit = Number(params.get('limit') ?? 10);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Límite inválido.');
  const filter = inboxFilter(params);
  const after = params.get('after') && uuid(params.get('after'));
  const [recipient, cursor] = await Promise.all([
    inboxRecipient(userId, filter.roadmapId, readAccess),
    after
      ? prisma.roadmapNotice.findFirst({
          where: { id: after, recipientId: userId },
          select: { id: true, availableAt: true },
        })
      : null,
  ]);
  if (after && !cursor) throw new ApplicationError(404, 'NOT_FOUND', 'Aviso no encontrado.');
  const page = await queryInboxPage(recipient, filter, {
    limit,
    cursor,
    grouped: params.get('groupBy') === 'roadmapId',
  });
  return { notifications: page.notices.map(noticeRecord), hasMore: page.hasMore };
}

export async function countOwnNoticeTargets(
  userId: string,
  params: URLSearchParams,
  readAccess: ParticipantAccessReader,
) {
  const filter = inboxFilter(params);
  return queryInboxCounts(await inboxRecipient(userId, filter.roadmapId, readAccess), filter);
}

export async function countOwnNodeChanges(
  userId: string,
  params: URLSearchParams,
  readAccess: ParticipantAccessReader,
) {
  const roadmapId = uuid(params.get('roadmapId'));
  return queryNodeChangeCounts(await inboxRecipient(userId, roadmapId, readAccess), roadmapId);
}

/** Opening a Node reviews its changes for the canvas mark; it never recognizes notices. */
export async function reviewOwnNode(userId: string, input: Record<string, unknown>) {
  const roadmapId = uuid(input.roadmapId);
  const nodeId = uuid(input.nodeId);
  await prisma.$transaction(async (transaction) => {
    const participation = await lockNoticeParticipation(transaction, userId, roadmapId);
    if (!participation?.isActive)
      throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
    const node = await transaction.roadmapNode.findFirst({
      where: { id: nodeId, roadmapId },
      select: { id: true },
    });
    if (!node) throw new ApplicationError(404, 'NOT_FOUND', 'Nodo no encontrado.');
    const identity = { recipientId: userId, nodeId };
    const reviewedAt = new Date();
    await transaction.nodeChangeReview.upsert({
      where: { recipientId_nodeId: identity },
      create: { ...identity, reviewedAt },
      update: { reviewedAt },
    });
  });
  return { reviewed: true };
}

export async function findOwnNotice(
  userId: string,
  id: string,
  readAccess: ParticipantAccessReader,
) {
  const notice = await prisma.roadmapNotice.findFirst({
    where: { id: uuid(id), recipientId: userId },
  });
  if (!notice || !(await isOwnNoticeVisible(userId, notice, readAccess)))
    throw new ApplicationError(404, 'NOT_FOUND', 'Aviso no encontrado.');
  const offering = await prisma.courseOffering.findUnique({
    where: { id: notice.courseOfferingId },
    select: { course: { select: { name: true } } },
  });
  return { ...notice, courseName: offering?.course.name };
}

// Capture committed, visible identities on the server when the Roadmap opens.
// Retrying recognition can never expand this set, even if delivery committed later.
export async function prepareOwnNoticeOpening(
  userId: string,
  roadmapId: string,
  readAccess: ParticipantAccessReader,
  operationId: string = randomUUID(),
  retry = false,
) {
  return prisma.$transaction(async (transaction) => {
    const participation = await lockNoticeParticipation(transaction, userId, roadmapId);
    if (!participation?.isActive)
      throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
    await lockRecipientRoadmap(transaction, userId, roadmapId);
    const existing = await transaction.noticeAcknowledgement.findUnique({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
    });
    if (existing) {
      await roadmapNodeAccess(readAccess, transaction, userId, roadmapId);
      if (existing.roadmapId !== roadmapId)
        throw new ApplicationError(400, 'INVALID_REQUEST', 'Apertura inválida.');
      return operationId;
    }
    if (retry) throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
    const [accessible, notices, nodes, roadmap] = await Promise.all([
      roadmapNodeAccess(readAccess, transaction, userId, roadmapId),
      transaction.roadmapNotice.findMany({
        where: { recipientId: userId, roadmapId, acknowledgedAt: null },
        select: { id: true, data: true },
        orderBy: [{ availableAt: 'desc' }, { id: 'desc' }],
      }),
      transaction.roadmapNode.findMany({
        where: { roadmapId },
        select: { id: true, title: true, isVisible: true, nodeTypeId: true },
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
        snapshots: await entryTargetSnapshots(transaction, userId, roadmapId, notices, accessible),
        summary: changeSummary(roadmap.courseOffering.courseCode, notices, nodes, accessible),
      },
    });
    return operation.operationId;
  });
}

export async function acknowledgeOwnNotices(
  userId: string,
  input: Record<string, unknown>,
  readAccess?: ParticipantAccessReader,
) {
  const operationId = uuid(input.operationId);
  const roadmapId = uuid(input.roadmapId);
  const operation = await prisma.noticeAcknowledgement.findUnique({
    where: { recipientId_operationId: { recipientId: userId, operationId } },
  });
  if (!operation || operation.roadmapId !== roadmapId) {
    throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
  }
  const result = await prisma.$transaction(async (transaction) => {
    const participation = await lockNoticeParticipation(transaction, userId, roadmapId);
    if (!participation?.isActive)
      throw new ApplicationError(403, 'FORBIDDEN', 'No tienes acceso a este Roadmap.');
    await lockRecipientRoadmap(transaction, userId, roadmapId);
    const retained = await transaction.noticeAcknowledgement.findUnique({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
    });
    if (!retained || retained.roadmapId !== roadmapId)
      throw new ApplicationError(404, 'NOT_FOUND', 'Apertura de Roadmap no encontrada.');
    if (retained.recognizedAt)
      return { count: 0, summary: retained.summary as ChangeSummary | null };
    const visited = await transaction.roadmapVisit.findUnique({
      where: { recipientId_roadmapId: { recipientId: userId, roadmapId } },
    });
    // A later entry captured all pending targets too. Its recognition must not
    // be undone by a delayed acknowledgement from an older tab. This watermark
    // survives pruning receipts, and the recipient/Roadmap lock makes the check
    // and all following baseline writes one indivisible operation.
    if (visited && retained.openingSequence <= visited.lastRecognizedOpeningSequence) {
      await transaction.noticeAcknowledgement.update({
        where: { recipientId_operationId: { recipientId: userId, operationId } },
        data: { recognizedAt: new Date(), summary: Prisma.JsonNull },
      });
      return { count: 0, summary: null };
    }
    await transaction.roadmapVisit.upsert({
      where: { recipientId_roadmapId: { recipientId: userId, roadmapId } },
      create: {
        recipientId: userId,
        roadmapId,
        lastRecognizedOpeningSequence: retained.openingSequence,
      },
      update: { lastRecognizedOpeningSequence: retained.openingSequence },
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
    const targetCount = await recognizeTargetSnapshots(transaction, {
      recipientId: userId,
      roadmapId,
      operationId,
      snapshots: retained.snapshots,
      readAccess,
    });
    const summary =
      visited && result.count + targetCount > 0 ? (retained.summary as ChangeSummary | null) : null;
    await transaction.noticeAcknowledgement.update({
      where: { recipientId_operationId: { recipientId: userId, operationId } },
      data: { recognizedAt: new Date(), summary: summary ?? Prisma.JsonNull },
    });
    return {
      count: result.count + targetCount,
      summary,
    };
  });
  return { acknowledged: result.count, summary: result.summary };
}
