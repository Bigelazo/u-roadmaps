import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { absorbs, containingTargets } from '../../application/absorption';
import {
  descriptorForNoticeTarget,
  noticeTargetDescriptors,
  SCOPE_DEPTH,
  type KnownTarget,
  type NoticeTargetRef,
  type RoadmapView,
} from '../../application/notice-targets';
import { pendingTargetSnapshots, type TargetSnapshot } from './recognize';
import { roadmapView } from './roadmap-view';

/**
 * (C) Capture what entering the Roadmap shows the recipient: its pending lifecycle
 * notices, the broad targets it has not recognized (even when their notice never
 * arrived), and the entry value of every target, as each descriptor enumerates them.
 * Values inside a recognized broad target reconcile fully; the rest only rebase pending
 * notices.
 */
export async function entryTargetSnapshots(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
  notices: readonly { id: string; data: Prisma.JsonValue }[],
  accessible: ReadonlySet<string>,
): Promise<Prisma.InputJsonArray> {
  const identity = { recipientId, roadmapId };
  const roadmap = roadmapView(transaction, roadmapId, async () => accessible);
  const [rows] = await Promise.all([
    transaction.noticeKnownValue.findMany({
      where: identity,
      select: { noticeTarget: true, targetKey: true, nodeId: true, knownValue: true },
    }),
    roadmap.preload(),
  ]);
  const known = await forgetVanishedBroadTargets(transaction, identity, roadmap, rows);
  const knownByKey = new Map(known.map((row) => [row.targetKey, row]));
  const pending = pendingTargetSnapshots(notices);
  const pendingKeys = new Set(pending.map(({ targetKey }) => targetKey));

  const shown: Omit<TargetSnapshot, 'id' | 'onlyPending'>[] = [];
  for (const descriptor of noticeTargetDescriptors) {
    if (!descriptor.entryValues) continue;
    const own = known.filter(({ noticeTarget }) => noticeTarget === descriptor.noticeTarget);
    for (const { target, currentValue, context } of await descriptor.entryValues(
      roadmap,
      recipientId,
      own,
    ))
      if (!(await insideHiddenUnknownTarget(target, roadmap, recipientId, knownByKey)))
        shown.push({ ...target, currentValue, ...(context ? { context } : {}) });
  }

  // Broad targets entry shows although their notice is not in the Inbox (e.g. still on its way).
  const isBroad = ({ noticeTarget }: { noticeTarget: string }) =>
    !!descriptorForNoticeTarget(noticeTarget)?.scope;
  const unannounced = shown
    .filter((snapshot) => isBroad(snapshot) && !pendingKeys.has(snapshot.targetKey))
    .sort((a, b) => broadness(a) - broadness(b))
    .map((snapshot) => ({ ...snapshot, id: null }));
  const broad = [...pending.filter(isBroad), ...unannounced];
  const recognizedBroad = new Set(broad.map(({ targetKey }) => targetKey));
  const state = shown
    .filter((snapshot) => !isBroad(snapshot))
    .map((snapshot) => ({
      ...snapshot,
      id: null,
      onlyPending: !containingTargets(roadmapId, snapshot).some(({ targetKey }) =>
        recognizedBroad.has(targetKey),
      ),
    }));

  // Broad targets first: their contents are then recognized as known Nodes.
  const narrow = pending.filter((snapshot) => !isBroad(snapshot));
  return [...broad, ...narrow, ...state] as Prisma.InputJsonArray;
}

/** Broadest scope first (Roadmap availability before Node creation). */
function broadness({ noticeTarget }: { noticeTarget: string }) {
  return SCOPE_DEPTH[descriptorForNoticeTarget(noticeTarget)?.scope ?? 'node'];
}

/** An unrecognized broad target that no longer exists has nothing left to tell. */
async function forgetVanishedBroadTargets(
  transaction: Prisma.TransactionClient,
  identity: { recipientId: string; roadmapId: string },
  roadmap: RoadmapView,
  known: readonly KnownTarget[],
) {
  const vanished = new Set<string>();
  for (const row of known) {
    const descriptor = descriptorForNoticeTarget(row.noticeTarget);
    if (!descriptor?.scope || !absorbs(row.knownValue)) continue;
    if (!(await descriptor.current(row, roadmap, identity.recipientId)))
      vanished.add(row.targetKey);
  }
  if (vanished.size)
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: { in: [...vanished] } },
    });
  return known.filter(({ targetKey }) => !vanished.has(targetKey));
}

/** A target inside a broad target the recipient never recognized and cannot see stays unknown. */
async function insideHiddenUnknownTarget(
  target: NoticeTargetRef,
  roadmap: RoadmapView,
  recipientId: string,
  known: ReadonlyMap<string, KnownTarget>,
) {
  for (const broad of containingTargets(roadmap.roadmapId, target)) {
    if (!absorbs(known.get(broad.targetKey)?.knownValue)) continue;
    const descriptor = descriptorForNoticeTarget(broad.noticeTarget);
    if (!(await descriptor?.current(broad, roadmap, recipientId))?.visible) return true;
  }
  return false;
}
