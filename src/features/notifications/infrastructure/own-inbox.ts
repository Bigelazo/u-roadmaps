import { lockNoticeParticipation } from './participation-lock';
import { visibleOwnNotices } from './notice-visibility';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import {
  queryInboxPage,
  queryInboxCounts,
  queryNodeChangeCounts,
  type InboxFilter,
} from './inbox-query';
import { changeSummary } from '../application/change-summary';
import type { ChangeSummary } from '../contracts/change-summary';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import { entryTargetSnapshots, recognizeTargetSnapshots } from './notice-lifecycle';
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

export type NoticeNodeAccess = (
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) => Promise<ReadonlySet<string>>;

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

function inboxFilter(params: URLSearchParams): InboxFilter {
  noticeFilter(params); // Share the HTTP filter validation with the legacy read contract.
  return {
    ...(params.get('roadmapId') ? { roadmapId: uuid(params.get('roadmapId')) } : {}),
    ...(params.get('nodeId') ? { nodeId: params.get('nodeId')! } : {}),
    ...(params.get('courseCode') ? { courseCode: params.get('courseCode')! } : {}),
    ...(params.get('year') ? { year: Number(params.get('year')) } : {}),
    ...(params.get('semester') ? { semester: Number(params.get('semester')) } : {}),
  };
}

export async function listOwnNotices(userId: string, params: URLSearchParams) {
  const limit = Number(params.get('limit') ?? 10);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new ApplicationError(400, 'INVALID_REQUEST', 'Límite inválido.');
  const filter = inboxFilter(params);
  const after = params.get('after');
  const cursor = after
    ? await prisma.roadmapNotice.findFirst({
        where: { id: uuid(after), recipientId: userId },
        select: { id: true, availableAt: true },
      })
    : null;
  if (after && !cursor) throw new ApplicationError(404, 'NOT_FOUND', 'Aviso no encontrado.');
  const page = await queryInboxPage(userId, filter, {
    limit,
    cursor,
    grouped: params.get('groupBy') === 'roadmapId',
  });
  return { notifications: page.notices.map(noticeRecord), hasMore: page.hasMore };
}

export function countOwnNoticeTargets(userId: string, params: URLSearchParams) {
  return queryInboxCounts(userId, inboxFilter(params));
}

export function countOwnNodeChanges(userId: string, params: URLSearchParams) {
  return queryNodeChangeCounts(userId, uuid(params.get('roadmapId')));
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

export async function findOwnNotice(userId: string, id: string, accessibleNodes: NoticeNodeAccess) {
  const notice = await prisma.roadmapNotice.findFirst({
    where: { id: uuid(id), recipientId: userId },
  });
  if (!notice || !(await visibleOwnNotices(userId, [notice], accessibleNodes)).length)
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
  accessibleNodes: NoticeNodeAccess,
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
  accessibleNodes?: NoticeNodeAccess,
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
      accessibleNodes,
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
