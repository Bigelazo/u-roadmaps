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

const knownValueColumns = () =>
  Prisma.sql`"recipientId", "roadmapId", "targetKey", "noticeTarget", "nodeId", "knownValue"`;
const onKnownValueConflict = () =>
  Prisma.sql`ON CONFLICT ("recipientId", "roadmapId", "targetKey")`;

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
    INSERT INTO "NoticeKnownValue" (${knownValueColumns()}, "currentValue")
    SELECT recipient, ${roadmapId}::uuid, ${target.targetKey}, ${target.noticeTarget},
      ${target.nodeId ?? null}::uuid, ${knownValue}, ${currentValue}
    FROM unnest(${[...knowerIds]}::uuid[]) AS recipient
    ${onKnownValueConflict()} DO UPDATE SET "currentValue" = EXCLUDED."currentValue"`;
}

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

export async function advanceKnownValue(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  target: NoticeTargetRef,
  previousValue: string,
  knownValue: string,
  context: TargetContext = {},
) {
  const advanced = await transaction.$queryRaw<unknown[]>`
    INSERT INTO "NoticeKnownValue" (${knownValueColumns()}, "context")
    VALUES (${identity.recipientId}::uuid, ${identity.roadmapId}::uuid, ${target.targetKey},
      ${target.noticeTarget}, ${target.nodeId ?? null}::uuid, ${knownValue},
      ${JSON.stringify(context)}::jsonb)
    ${onKnownValueConflict()} DO UPDATE SET "knownValue" = EXCLUDED."knownValue", "context" = EXCLUDED."context"
    WHERE "NoticeKnownValue"."knownValue" = ${previousValue}
    RETURNING 1`;
  return advanced.length > 0;
}

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
  for (const end of DEPENDENCY_ENDS)
    await transaction.$executeRaw`
      DELETE FROM "NoticeKnownValue"
      WHERE "roadmapId" = ${roadmapId}::uuid AND ${dependencyIndexPredicate()}
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

export const DEPENDENCY_ENDS = ['source', 'target'] as const;
const DEPENDENCY_KEY_PART = { source: 2, target: 3 } as const;

export function dependencyKeyNode(end: (typeof DEPENDENCY_ENDS)[number]) {
  return Prisma.raw(`split_part("targetKey", ':', ${DEPENDENCY_KEY_PART[end]})`);
}

export const dependencyIndexPredicate = () =>
  Prisma.raw(`"noticeTarget" = '${NOTICE_TARGET.dependency}'`);
