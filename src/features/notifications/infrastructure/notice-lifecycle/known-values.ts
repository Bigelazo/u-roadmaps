import 'server-only';
import { ABSENT, nodeCreationRef } from '../../application/absorption';
import type { Prisma } from '@/shared/server/db';
import {
  targetContext,
  type NoticeTargetRef,
  type TargetContext,
} from '../../application/notice-targets';

export type RecipientRoadmap = Readonly<{ recipientId: string; roadmapId: string }>;

/** Record a baseline for recipients that have none yet; the first baseline wins. */
export async function recordKnownValues(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  target: NoticeTargetRef,
  recipientIds: readonly string[],
  knownValue: string,
  context: TargetContext = {},
) {
  if (!recipientIds.length) return;
  await transaction.noticeKnownValue.createMany({
    data: recipientIds.map((recipientId) => ({
      recipientId,
      roadmapId,
      noticeTarget: target.noticeTarget,
      targetKey: target.targetKey,
      nodeId: target.nodeId,
      knownValue,
      context: context as Prisma.InputJsonObject,
    })),
    skipDuplicates: true,
  });
}

/** The target's value at edit time for recipients that have a Known value (see `currentAtEdit`). */
export async function recordCurrentValues(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  target: NoticeTargetRef,
  recipientIds: readonly string[],
  currentValue: string,
) {
  if (!recipientIds.length) return;
  await transaction.noticeKnownValue.updateMany({
    where: { roadmapId, targetKey: target.targetKey, recipientId: { in: [...recipientIds] } },
    data: { currentValue },
  });
}

/** The recipient's Known value and its context, recording `fallback` when the target has no baseline yet. */
export async function ensureKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  fallback: string,
  fallbackContext?: TargetContext,
) {
  await recordKnownValues(
    transaction,
    identity.roadmapId,
    target,
    [identity.recipientId],
    fallback,
    fallbackContext,
  );
  const row = await transaction.noticeKnownValue.findUniqueOrThrow({
    where: { recipientId_roadmapId_targetKey: { ...identity, targetKey: target.targetKey } },
    select: { knownValue: true, currentValue: true, context: true },
  });
  return {
    knownValue: row.knownValue,
    currentValue: row.currentValue,
    context: targetContext(row.context),
  };
}

/**
 * The actor's own change: advance the Known value to `knownValue` unless it differs from
 * the value the change started from (`previousValue`), i.e. a colleague's difference is
 * still untold. Returns false then (the Known value is left as it is).
 */
export async function advanceKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  previousValue: string,
  knownValue: string,
  context: TargetContext = {},
) {
  const where = { ...identity, targetKey: target.targetKey };
  const data = { knownValue, context: context as Prisma.InputJsonObject };
  const { count } = await transaction.noticeKnownValue.updateMany({
    where: { ...where, knownValue: previousValue },
    data,
  });
  if (count) return true;
  const known = await transaction.noticeKnownValue.findUnique({
    where: { recipientId_roadmapId_targetKey: where },
    select: { knownValue: true },
  });
  if (known) return false;
  await setKnownValue(transaction, identity, target, knownValue, context);
  return true;
}

/** Recognition: the recipient now knows `knownValue`. */
export async function setKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  knownValue: string,
  context: TargetContext = {},
) {
  const known = { knownValue, context: context as Prisma.InputJsonObject };
  await transaction.noticeKnownValue.upsert({
    where: { recipientId_roadmapId_targetKey: { ...identity, targetKey: target.targetKey } },
    create: {
      ...identity,
      noticeTarget: target.noticeTarget,
      targetKey: target.targetKey,
      nodeId: target.nodeId,
      ...known,
    },
    update: known,
  });
}

/**
 * A deleted Node's targets, and the Dependency pairs it was part of, have nothing left to
 * compare. A recipient who never recognized the Node's creation is not told of its
 * deletion: the creation absorbs it, so its pending creation notice is withdrawn here.
 * Returns the deletion's recipients who knew the Node (`aware`) and those who did not
 * (`unaware`): a creation notice delivered concurrently may be invisible to this
 * transaction's snapshot, so delivery withdraws it again for them.
 */
export async function forgetDeletedNode(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  nodeId: string,
  deletionRecipientIds: readonly string[],
): Promise<{ aware: string[]; unaware: string[] }> {
  const creation = nodeCreationRef(nodeId).targetKey;
  const unaware = new Set(
    (
      await transaction.noticeKnownValue.findMany({
        where: { roadmapId, targetKey: creation, knownValue: ABSENT },
        select: { recipientId: true },
      })
    ).map(({ recipientId }) => recipientId),
  );
  await transaction.roadmapNotice.deleteMany({
    where: {
      roadmapId,
      targetKey: creation,
      acknowledgedAt: null,
      recipientId: { in: [...unaware] },
    },
  });
  await transaction.noticeKnownValue.deleteMany({
    where: {
      roadmapId,
      OR: [
        { nodeId },
        { targetKey: { startsWith: `dependency:${nodeId}:` } },
        { targetKey: { startsWith: 'dependency:', endsWith: `:${nodeId}` } },
      ],
    },
  });
  return {
    aware: deletionRecipientIds.filter((recipientId) => !unaware.has(recipientId)),
    unaware: [...unaware],
  };
}
