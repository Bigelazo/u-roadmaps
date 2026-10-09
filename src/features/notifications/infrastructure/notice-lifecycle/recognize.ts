import 'server-only';
import type { Prisma } from '@/shared/server/db';
import {
  descriptorForNoticeTarget,
  storedTargetValues,
  targetContext,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type RoadmapView,
  type TargetContext,
} from '../../application/notice-targets';
import { PRESENT, nodeCreationRef, nodeDeletionRef } from '../../application/absorption';
import { acknowledgeCapturedNotice } from '../recognition-snapshot';
import { setKnownValue, type RecipientRoadmap } from './known-values';
import { roadmapView, type NodeAccessReader } from './roadmap-view';
import { reconcileNoticeTarget } from './reconcile';
import { lazyNoticeCourseContext, type NoticeCourseContext } from './course-context';

/**
 * One target as entry exposed it: a pending notice (`id`), or a value the recipient saw
 * without one (`id` null). `onlyPending` values advance the Known value but only rebase a
 * pending notice; values inside a recognized broad target reconcile fully.
 */
export type TargetSnapshot = NoticeTargetRef &
  Readonly<{
    id: string | null;
    currentValue: string;
    /** Presentation context of the captured value, recognized with it. */
    context?: TargetContext;
    onlyPending?: boolean;
  }>;

/** (C) Capture: the pending lifecycle notices of an opening record. */
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

/** (C) Recognize captured values once, rebasing any later delivery onto them. */
export async function recognizeTargetSnapshots(
  transaction: Prisma.TransactionClient,
  {
    recipientId,
    roadmapId,
    operationId,
    snapshots,
    accessibleNodes,
  }: {
    recipientId: string;
    roadmapId: string;
    operationId: string;
    snapshots: Prisma.JsonValue;
    accessibleNodes?: NodeAccessReader;
  },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid notice opening snapshots.');
  const identity = { recipientId, roadmapId };
  const courseContext = lazyNoticeCourseContext(transaction, roadmapId);
  const recognized = snapshots.map(targetSnapshot);
  // Recognition never edits the Roadmap: one view, loaded at once, serves every target.
  const roadmap = roadmapView(transaction, roadmapId, accessibleNodes);
  if (recognized.length) await roadmap.preload();
  let acknowledged = 0;
  for (const { snapshot, target, descriptor } of recognized) {
    if (snapshot.id)
      acknowledged += await acknowledgeCapturedNotice(
        transaction,
        { id: snapshot.id, ...identity },
        (data) => storedTargetValues(data)?.values.currentValue === snapshot.currentValue,
      );
    await recognizeKnownValue(transaction, {
      identity,
      descriptor,
      target,
      knownValue: snapshot.currentValue,
      context: targetContext(snapshot.context),
      eventId: `recognition:${operationId}:${snapshot.targetKey}`,
      courseContext,
      onlyPending: snapshot.onlyPending,
      roadmap,
    });
  }
  const broad = recognized.filter(({ descriptor }) => descriptor.scope);
  for (const { snapshot, target, descriptor } of broad) {
    if (descriptor.scope !== 'node' || !snapshot.nodeId) continue;
    if (await descriptor.current(target, roadmap, recipientId)) continue;
    // The Node entry showed is gone: the recipient knew it, so its deletion is news.
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: nodeCreationRef(snapshot.nodeId).targetKey },
    });
    const deletion = nodeDeletionRef(snapshot.nodeId);
    const deletionDescriptor = descriptorForNoticeTarget(deletion.noticeTarget);
    if (!deletionDescriptor) continue;
    await reconcileNoticeTarget(transaction, {
      descriptor: deletionDescriptor,
      identity,
      target: deletion,
      fallbackKnown: PRESENT,
      context: { nodeTitle: targetContext(snapshot.context).nodeTitle },
      roadmap,
      courseContext,
      eventId: `recognition:${operationId}:${deletion.targetKey}`,
      occurredAt: new Date(),
    });
  }
  // Changes inside a recognized broad target that entry did not show are news now.
  const captured = new Set(recognized.map(({ snapshot }) => snapshot.targetKey));
  for (const { snapshot, descriptor } of broad) {
    if (snapshot.onlyPending) continue;
    await reconcileUncaptured(transaction, {
      identity,
      scope: descriptor.scope === 'node' ? { nodeId: snapshot.nodeId } : {},
      captured,
      roadmap,
      courseContext,
      operationId,
    });
  }
  return acknowledged;
}

/**
 * Reconcile, in one pass, the recipient's Known values in a recognized broad target that
 * entry did not capture: only targets with a pending notice or a changed value are
 * reconciled one by one; the rest are compared against the already loaded view.
 */
async function reconcileUncaptured(
  transaction: Prisma.TransactionClient,
  input: {
    identity: RecipientRoadmap;
    scope: { nodeId?: string | null };
    captured: Set<string>;
    roadmap: RoadmapView;
    courseContext: () => Promise<NoticeCourseContext>;
    operationId: string;
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
    await reconcileNoticeTarget(transaction, {
      descriptor,
      identity,
      target,
      fallbackKnown: known.knownValue,
      roadmap,
      courseContext: input.courseContext,
      eventId: `recognition:${input.operationId}:${known.targetKey}`,
      occurredAt: new Date(),
    });
  }
}

/**
 * The recipient now knows `knownValue` for the target. Any pending notice is
 * rebased on it; with `onlyPending`, a target without one stays silent.
 */
export async function recognizeKnownValue(
  transaction: Prisma.TransactionClient,
  input: {
    identity: RecipientRoadmap;
    descriptor: NoticeTargetDescriptor;
    target: NoticeTargetRef;
    knownValue: string;
    /** Presentation context of the recognized value. */
    context?: TargetContext;
    eventId: string;
    courseContext: () => Promise<NoticeCourseContext>;
    onlyPending?: boolean;
    roadmap: RoadmapView;
  },
) {
  const { identity, target, roadmap } = input;
  if (!(await input.descriptor.current(target, roadmap, identity.recipientId))) return;
  if (input.descriptor.keepsKnownValue !== false)
    await setKnownValue(transaction, identity, target, input.knownValue, input.context);
  if (
    input.onlyPending &&
    !(await transaction.roadmapNotice.findFirst({
      where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
      select: { id: true },
    }))
  )
    return;
  await reconcileNoticeTarget(transaction, {
    descriptor: input.descriptor,
    identity,
    target,
    fallbackKnown: input.knownValue,
    fallbackContext: input.context,
    roadmap,
    courseContext: input.courseContext,
    eventId: input.eventId,
    occurredAt: new Date(),
  });
}
