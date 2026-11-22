import 'server-only';
import type { Prisma } from '@/shared/server/db';
import {
  descriptorForNoticeTarget,
  storedTargetValues,
  targetContext,
  type NoticeTargetRef,
  type RoadmapView,
  type TargetContext,
} from '../../application/notice-targets';
import { PRESENT, nodeCreationRef, nodeDeletionRef } from '../../application/absorption';
import { setKnownValues, type KnownValueUpdate, type RecipientRoadmap } from './known-values';
import { roadmapView, type ParticipantAccessReader } from './roadmap-view';
import { reconcileFor } from './reconcile';
import { lazyNoticeCourseContext } from './course-context';

export type TargetSnapshot = NoticeTargetRef &
  Readonly<{
    id: string | null;
    currentValue: string;
    context?: TargetContext;
    onlyPending?: boolean;
  }>;

export function pendingTargetSnapshots(
  notices: readonly { id: string; data: Prisma.JsonValue }[],
): TargetSnapshot[] {
  return notices.flatMap((notice) => {
    const stored = storedTargetValues(notice.data);
    const data = notice.data as Record<string, unknown>;
    if (!stored || typeof data.targetKey !== 'string') return [];
    return [
      {
        id: notice.id,
        noticeTarget: stored.descriptor.noticeTarget,
        targetKey: data.targetKey,
        nodeId: typeof data.nodeId === 'string' ? data.nodeId : null,
        currentValue: stored.values.currentValue,
        context: stored.values.context,
      },
    ];
  });
}

function targetSnapshot(value: Prisma.JsonValue) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value.id !== null && typeof value.id !== 'string') ||
    typeof value.targetKey !== 'string' ||
    typeof value.currentValue !== 'string' ||
    (value.nodeId !== null && typeof value.nodeId !== 'string')
  )
    throw new Error('Invalid notice opening snapshot.');
  const descriptor = descriptorForNoticeTarget(value.noticeTarget);
  if (!descriptor) throw new Error('Unknown Notice target in opening snapshot.');
  const snapshot = value as unknown as TargetSnapshot;
  const target = {
    noticeTarget: descriptor.noticeTarget,
    targetKey: snapshot.targetKey,
    nodeId: snapshot.nodeId,
  };
  return { snapshot, target, descriptor };
}

export async function recognizeTargetSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
    readAccess,
  }: {
    recipientId: string;
    roadmapId: string;
    operationId: string;
    snapshots: Prisma.JsonValue;
    readAccess?: ParticipantAccessReader;
  },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid notice opening snapshots.');
  const identity = { recipientId, roadmapId };
  const recognized = snapshots.map(targetSnapshot);
  const roadmap = roadmapView(transaction, roadmapId, readAccess);
  if (recognized.length) await roadmap.preload();
  const reconciler = reconcileFor(transaction, {
    identity,
    roadmap,
    courseContext: lazyNoticeCourseContext(transaction, roadmapId),
    eventId: (targetKey) => `recognition:${operationId}:${targetKey}`,
  });
  let acknowledged = 0;
  let pendingTargetKeys: ReadonlySet<string> | undefined;
  const unannouncedKnownValues = new Map<string, KnownValueUpdate>();
  const recordUnannouncedKnownValues = async () => {
    await setKnownValues(transaction, identity, [...unannouncedKnownValues.values()]);
    unannouncedKnownValues.clear();
  };
  for (const { snapshot, target, descriptor } of recognized) {
    const knownValue = {
      target,
      knownValue: snapshot.currentValue,
      context: targetContext(snapshot.context),
    };
    if (snapshot.onlyPending && !snapshot.id) {
      pendingTargetKeys ??= await readPendingTargetKeys(transaction, identity);
      if (!pendingTargetKeys.has(snapshot.targetKey)) {
        if (
          descriptor.keepsKnownValue !== false &&
          (await descriptor.current(target, roadmap, recipientId))
        )
          unannouncedKnownValues.set(snapshot.targetKey, knownValue);
        continue;
      }
    }
    await recordUnannouncedKnownValues();
    pendingTargetKeys = undefined;
    if (snapshot.id) {
      const captured = await transaction.roadmapNotice.findFirst({
        where: { id: snapshot.id, ...identity, acknowledgedAt: null },
      });
      if (
        captured &&
        storedTargetValues(captured.data)?.values.currentValue === snapshot.currentValue
      ) {
        await transaction.roadmapNotice.update({
          where: { id: captured.id },
          data: { acknowledgedAt: new Date() },
        });
        acknowledged += 1;
      }
    }
    if (!(await descriptor.current(target, roadmap, recipientId))) continue;
    if (descriptor.keepsKnownValue !== false)
      await setKnownValues(transaction, identity, [knownValue]);
    if (snapshot.onlyPending && !(await reconciler.pending(snapshot.targetKey))) continue;
    await reconciler.reconcile({
      descriptor,
      target,
      fallbackKnown: snapshot.currentValue,
      fallbackContext: knownValue.context,
    });
  }
  await recordUnannouncedKnownValues();
  const broad = recognized.filter(({ descriptor }) => descriptor.scope);
  for (const { snapshot, target, descriptor } of broad) {
    if (descriptor.scope !== 'node' || !snapshot.nodeId) continue;
    if (await descriptor.current(target, roadmap, recipientId)) continue;
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: nodeCreationRef(snapshot.nodeId).targetKey },
    });
    const deletion = nodeDeletionRef(snapshot.nodeId);
    const deletionDescriptor = descriptorForNoticeTarget(deletion.noticeTarget);
    if (!deletionDescriptor) continue;
    await reconciler.reconcile({
      descriptor: deletionDescriptor,
      target: deletion,
      fallbackKnown: PRESENT,
      context: { nodeTitle: targetContext(snapshot.context).nodeTitle },
    });
  }
  const captured = new Set(recognized.map(({ snapshot }) => snapshot.targetKey));
  for (const { snapshot, descriptor } of broad) {
    if (snapshot.onlyPending) continue;
    await reconcileUncaptured(transaction, {
      identity,
      scope: descriptor.scope === 'node' ? { nodeId: snapshot.nodeId } : {},
      captured,
      roadmap,
      reconcile: reconciler.reconcile,
    });
  }
  return acknowledged;
}

async function readPendingTargetKeys(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
): Promise<ReadonlySet<string>> {
  const pending = await transaction.roadmapNotice.findMany({
    where: { ...identity, acknowledgedAt: null },
    select: { targetKey: true },
  });
  return new Set(pending.flatMap(({ targetKey }) => (targetKey === null ? [] : [targetKey])));
}

async function reconcileUncaptured(
  transaction: Prisma.TransactionClient,
  input: {
    identity: RecipientRoadmap;
    scope: { nodeId?: string | null };
    captured: Set<string>;
    roadmap: RoadmapView;
    reconcile: ReturnType<typeof reconcileFor>['reconcile'];
  },
) {
  const { identity, captured, roadmap } = input;
  const later = (
    await transaction.noticeKnownValue.findMany({ where: { ...identity, ...input.scope } })
  ).filter(({ targetKey }) => !captured.has(targetKey));
  if (!later.length) return;
  const pending = new Set(
    (
      await transaction.roadmapNotice.findMany({
        where: {
          ...identity,
          acknowledgedAt: null,
          targetKey: { in: later.map(({ targetKey }) => targetKey) },
        },
        select: { targetKey: true },
      })
    ).map(({ targetKey }) => targetKey),
  );
  for (const known of later) {
    const descriptor = descriptorForNoticeTarget(known.noticeTarget);
    if (!descriptor || captured.has(known.targetKey)) continue;
    captured.add(known.targetKey);
    const target = {
      noticeTarget: known.noticeTarget,
      targetKey: known.targetKey,
      nodeId: known.nodeId,
    };
    if (!pending.has(known.targetKey)) {
      const current = await descriptor.current(target, roadmap, identity.recipientId);
      const value = descriptor.currentAtEdit
        ? (known.currentValue ?? known.knownValue)
        : current?.value;
      if (current && value === known.knownValue) continue;
    }
    await input.reconcile({ descriptor, target, fallbackKnown: known.knownValue });
  }
}
