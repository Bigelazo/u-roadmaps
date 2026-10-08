import 'server-only';
import type { Prisma } from '@/shared/server/db';
import {
  descriptorForNoticeTarget,
  storedTargetValues,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
} from '../../application/notice-targets';
import { acknowledgeCapturedNotice } from '../recognition-snapshot';
import { setKnownValue, type RecipientRoadmap } from './known-values';
import { roadmapView } from './roadmap-view';
import { reconcileNoticeTarget, type NoticeEnvelope } from './reconcile';
import { roadmapEnvelope } from './envelope';

/** One pending notice captured when the Roadmap was entered. */
type TargetSnapshot = Readonly<{
  id: string;
  noticeTarget: string;
  targetKey: string;
  nodeId: string | null;
  currentValue: string;
}>;

/** (C) Capture: the single snapshot collection of an opening record. */
export function targetOpeningSnapshots(
  notices: readonly { id: string; data: Prisma.JsonValue }[],
): Prisma.InputJsonArray {
  return notices.flatMap((notice): TargetSnapshot[] => {
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
      },
    ];
  });
}

function targetSnapshot(value: Prisma.JsonValue) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.id !== 'string' ||
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
  }: { recipientId: string; roadmapId: string; operationId: string; snapshots: Prisma.JsonValue },
) {
  if (!Array.isArray(snapshots)) throw new Error('Invalid notice opening snapshots.');
  const identity = { recipientId, roadmapId };
  const envelope = lazyRoadmapEnvelope(transaction, roadmapId);
  let acknowledged = 0;
  for (const value of snapshots) {
    const { snapshot, descriptor } = targetSnapshot(value);
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
      eventId: `recognition:${operationId}:${snapshot.targetKey}`,
      envelope,
    });
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
    eventId: string;
    envelope: () => Promise<NoticeEnvelope>;
    onlyPending?: boolean;
  },
) {
  const { identity, target } = input;
  const roadmap = roadmapView(transaction, identity.roadmapId);
  if (!(await input.descriptor.current(target, roadmap))) return;
  await setKnownValue(transaction, identity, target, input.knownValue);
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
    roadmap,
    envelope: input.envelope,
    eventId: input.eventId,
    occurredAt: new Date(),
  });
}
