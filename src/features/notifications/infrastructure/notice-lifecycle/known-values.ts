import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { NoticeTargetRef } from '../../application/notice-targets';

export type RecipientRoadmap = Readonly<{ recipientId: string; roadmapId: string }>;

/** Record a baseline for recipients that have none yet; the first baseline wins. */
export async function recordKnownValues(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  target: NoticeTargetRef,
  recipientIds: readonly string[],
  knownValue: string,
) {
  if (!recipientIds.length) return;
  await transaction.noticeKnownValue.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      roadmapId,
      targetKey: target.targetKey,
      nodeId: target.nodeId,
      knownValue,
    })),
    skipDuplicates: true,
  });
}

/** The recipient's Known value, recording `fallback` when the target has no baseline yet. */
export async function ensureKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  fallback: string,
) {
  await recordKnownValues(
    transaction,
    identity.roadmapId,
    target,
    [identity.recipientId],
    fallback,
  );
  const row = await transaction.noticeKnownValue.findUniqueOrThrow({
    where: { recipientId_roadmapId_targetKey: { ...identity, targetKey: target.targetKey } },
    select: { knownValue: true },
  });
  return row.knownValue;
}

/** Recognition: the recipient now knows `knownValue`. */
export async function setKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  knownValue: string,
) {
  await transaction.noticeKnownValue.upsert({
    where: { recipientId_roadmapId_targetKey: { ...identity, targetKey: target.targetKey } },
    create: { ...identity, targetKey: target.targetKey, nodeId: target.nodeId, knownValue },
    update: { knownValue },
  });
}

/** A deleted Node's targets have no Known values left to compare with. */
export async function forgetNodeKnownValues(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  nodeId: string,
) {
  await transaction.noticeKnownValue.deleteMany({ where: { roadmapId, nodeId } });
}
