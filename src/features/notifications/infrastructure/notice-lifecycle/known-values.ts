import 'server-only';
import { ABSENT, nodeCreationRef } from '../../application/absorption';
import { Prisma } from '@/shared/server/db';
import { NOTICE_TARGET } from '../../application/notice-targets/kinds';
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

const KNOWN_VALUE_COLUMNS = Prisma.sql`"recipientId", "roadmapId", "targetKey", "noticeTarget", "nodeId", "knownValue"`;
const ON_KNOWN_VALUE_CONFLICT = Prisma.sql`ON CONFLICT ("recipientId", "roadmapId", "targetKey")`;

/**
 * Store the target's value at edit time (see `currentAtEdit`) on the knowers' Known
 * values. Callers pass knowers only (`recordNoticeTargets` checks it), whose baseline
 * already exists, so the upsert only updates: the insert arm never runs. An upsert, not an
 * UPDATE, because under SERIALIZABLE it takes no predicate (SIRead) locks: an UPDATE per
 * recipient reads each row, and past 32 rows PostgreSQL promotes those locks to the whole
 * table, which then conflicts with Known value writes of edits on every other Roadmap (#220).
 */
export async function recordKnowersValueAtEdit(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  target: NoticeTargetRef,
  knowerIds: readonly string[],
  knownValue: string,
  currentValue: string,
) {
  if (!knowerIds.length) return;
  await transaction.$executeRaw`
    INSERT INTO "NoticeKnownValue" (${KNOWN_VALUE_COLUMNS}, "currentValue")
    SELECT recipient, ${roadmapId}::uuid, ${target.targetKey}, ${target.noticeTarget},
      ${target.nodeId ?? null}::uuid, ${knownValue}, ${currentValue}
    FROM unnest(${[...knowerIds]}::uuid[]) AS recipient
    ${ON_KNOWN_VALUE_CONFLICT} DO UPDATE SET "currentValue" = EXCLUDED."currentValue"`;
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
  // One upsert, not UPDATE-then-SELECT: it takes no predicate (SIRead) lock (#220).
  const advanced = await transaction.$queryRaw<unknown[]>`
    INSERT INTO "NoticeKnownValue" (${KNOWN_VALUE_COLUMNS}, "context")
    VALUES (${identity.recipientId}::uuid, ${identity.roadmapId}::uuid, ${target.targetKey},
      ${target.noticeTarget}, ${target.nodeId ?? null}::uuid, ${knownValue},
      ${JSON.stringify(context)}::jsonb)
    ${ON_KNOWN_VALUE_CONFLICT} DO UPDATE SET "knownValue" = EXCLUDED."knownValue", "context" = EXCLUDED."context"
    WHERE "NoticeKnownValue"."knownValue" = ${previousValue}
    RETURNING 1`;
  return advanced.length > 0;
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
 *
 * Runs in the serializable roadmap transaction, so each statement deletes exactly the
 * rows its index range reads: PostgreSQL then drops the per-row predicate locks instead
 * of promoting them, past 32 recipients, to a lock on the whole table (#220).
 */
export async function forgetDeletedNode(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  nodeId: string,
  deletionRecipientIds: readonly string[],
): Promise<{ aware: string[]; unaware: string[] }> {
  const creation = nodeCreationRef(nodeId).targetKey;
  const forgotten = await transaction.$queryRaw<
    { recipientId: string; targetKey: string; knownValue: string }[]
  >`
    DELETE FROM "NoticeKnownValue" WHERE "roadmapId" = ${roadmapId}::uuid AND "nodeId" = ${nodeId}::uuid
    RETURNING "recipientId"::text, "targetKey", "knownValue"`;
  // Dependency pairs carry no nodeId: one exact index range per end of the pair.
  for (const end of DEPENDENCY_ENDS)
    await transaction.$executeRaw`
      DELETE FROM "NoticeKnownValue"
      WHERE "roadmapId" = ${roadmapId}::uuid AND ${dependencyIndexPredicate}
        AND ${dependencyKeyNode(end)} = ${nodeId}`;
  const unaware = new Set(
    forgotten
      .filter(({ targetKey, knownValue }) => targetKey === creation && knownValue === ABSENT)
      .map(({ recipientId }) => recipientId),
  );
  await transaction.$executeRaw`
    DELETE FROM "RoadmapNotice"
    WHERE "roadmapId" = ${roadmapId}::uuid AND "targetKey" = ${creation}
      AND "acknowledgedAt" IS NULL AND "recipientId" = ANY(${[...unaware]}::uuid[])`;
  return {
    aware: deletionRecipientIds.filter((recipientId) => !unaware.has(recipientId)),
    unaware: [...unaware],
  };
}

/** The two ends of a Dependency pair key, `dependency:<source>:<target>` (`dependencyTarget`). */
export const DEPENDENCY_ENDS = ['source', 'target'] as const;
const DEPENDENCY_KEY_PART = { source: 2, target: 3 } as const;

/**
 * SQL for the Node id at one end of a Dependency pair key. The partial expression indexes
 * `NoticeKnownValue_dependency_{source,target}_idx` (migration
 * 20261009210000_notice_lifecycle_index_ranges) are built on exactly this expression and on
 * `dependencyIndexPredicate`, with literals (not parameters) so the planner matches them;
 * `dependency-key-indexes.test.ts` keeps them in sync.
 */
export function dependencyKeyNode(end: (typeof DEPENDENCY_ENDS)[number]) {
  return Prisma.raw(`split_part("targetKey", ':', ${DEPENDENCY_KEY_PART[end]})`);
}

export const dependencyIndexPredicate = Prisma.raw(
  `"noticeTarget" = '${NOTICE_TARGET.dependency}'`,
);
