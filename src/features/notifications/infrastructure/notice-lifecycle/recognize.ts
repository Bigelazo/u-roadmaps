import 'server-only';
import type { Prisma } from '@/shared/server/db';
import {
  descriptorForNoticeTarget,
  descriptorForTargetKey,
  storedTargetValues,
  targetContext,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type TargetContext,
} from '../../application/notice-targets';
import { PRESENT, nodeCreationRef, nodeDeletionRef } from '../../application/absorption';
import { acknowledgeCapturedNotice } from '../recognition-snapshot';
import { setKnownValue, type RecipientRoadmap } from './known-values';
import { roadmapView, type NodeAccessReader } from './roadmap-view';
import { reconcileNoticeTarget, type NoticeEnvelope } from './reconcile';
import { roadmapEnvelope } from './envelope';

/**
 * One target as entry exposed it: a pending notice (`id`), or a value the recipient saw
 * without one (`id` null). `onlyPending` values advance the Known value but only rebase a
 * pending notice; values inside a recognized broad target reconcile fully.
 */
export type TargetSnapshot = Readonly<{
  id: string | null;
  noticeTarget: string;
  targetKey: string;
  nodeId: string | null;
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
  return { snapshot: value as unknown as TargetSnapshot, descriptor };
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
  const envelope = lazyRoadmapEnvelope(transaction, roadmapId);
  const recognized = snapshots.map(targetSnapshot);
  let acknowledged = 0;
  for (const { snapshot, descriptor } of recognized) {
    if (snapshot.id)
      acknowledged += await acknowledgeCapturedNotice(
        transaction,
        { id: snapshot.id, ...identity },
        (data) => storedTargetValues(data)?.values.currentValue === snapshot.currentValue,
      );
    await recognizeKnownValue(transaction, {
      identity,
      descriptor,
      target: { targetKey: snapshot.targetKey, nodeId: snapshot.nodeId },
      knownValue: snapshot.currentValue,
      context: targetContext(snapshot.context),
      eventId: `recognition:${operationId}:${snapshot.targetKey}`,
      envelope,
      onlyPending: snapshot.onlyPending,
      accessibleNodes,
    });
  }
  const broad = recognized.filter(({ descriptor }) => descriptor.scope);
  for (const { snapshot, descriptor } of broad) {
    if (descriptor.scope !== 'node' || !snapshot.nodeId) continue;
    const roadmap = roadmapView(transaction, roadmapId, accessibleNodes);
    const target = { targetKey: snapshot.targetKey, nodeId: snapshot.nodeId };
    if (await descriptor.current(target, roadmap, recipientId)) continue;
    // The Node entry showed is gone: the recipient knew it, so its deletion is news.
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: nodeCreationRef(snapshot.nodeId).targetKey },
    });
    const deletion = nodeDeletionRef(snapshot.nodeId);
    await reconcileNoticeTarget(transaction, {
      descriptor: descriptorForTargetKey(deletion.targetKey)!,
      identity,
      target: deletion,
      fallbackKnown: PRESENT,
      context: { nodeTitle: targetContext(snapshot.context).nodeTitle },
      roadmap,
      envelope,
      eventId: `recognition:${operationId}:${deletion.targetKey}`,
      occurredAt: new Date(),
    });
  }
  // Changes inside a recognized broad target that entry did not show are news now.
  const captured = new Set(recognized.map(({ snapshot }) => snapshot.targetKey));
  for (const { snapshot, descriptor } of broad) {
    if (snapshot.onlyPending) continue;
    const later = await transaction.noticeKnownValue.findMany({
      where: {
        ...identity,
        ...(descriptor.scope === 'node' ? { nodeId: snapshot.nodeId } : {}),
      },
    });
    for (const known of later) {
      const owner = descriptorForTargetKey(known.targetKey);
      if (!owner || captured.has(known.targetKey)) continue;
      captured.add(known.targetKey);
      await reconcileNoticeTarget(transaction, {
        descriptor: owner,
        identity,
        target: { targetKey: known.targetKey, nodeId: known.nodeId },
        fallbackKnown: known.knownValue,
        roadmap: roadmapView(transaction, roadmapId, accessibleNodes),
        envelope,
        eventId: `recognition:${operationId}:${known.targetKey}`,
        occurredAt: new Date(),
      });
    }
  }
  return acknowledged;
}

/** Course context loaded at most once, and only if a recognition writes a notice. */
export function lazyRoadmapEnvelope(transaction: Prisma.TransactionClient, roadmapId: string) {
  let envelope: Promise<NoticeEnvelope> | undefined;
  return () =>
    (envelope ??= roadmapEnvelope(transaction, roadmapId).then((loaded) => {
      if (!loaded) throw new Error('Roadmap not found.');
      return loaded;
    }));
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
    envelope: () => Promise<NoticeEnvelope>;
    onlyPending?: boolean;
    accessibleNodes?: NodeAccessReader;
  },
) {
  const { identity, target } = input;
  const roadmap = roadmapView(transaction, identity.roadmapId, input.accessibleNodes);
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
    envelope: input.envelope,
    eventId: input.eventId,
    occurredAt: new Date(),
  });
}
