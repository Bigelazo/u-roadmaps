import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import { nodeAccessState } from '@/shared/node-access';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import type { RoadmapView } from '../../application/notice-targets';
import { nodeAccessRef, nodeAccessTarget } from '../../application/notice-targets/node-access';
import { reconcileNoticeTarget } from './reconcile';
import { lazyRoadmapEnvelope } from './recognize';

/**
 * Non-teaching events (ADR-0024), recorded inside the roadmap transaction:
 * - Completion: the student's own access transitions advance that student's Known
 *   values and update or withdraw their pending access notices; never a new notice.
 * - Promotion to teaching staff: re-baseline access to the staff view, withdraw access notices.
 * The actor rule for teaching staff is not applied here.
 */
export async function recordOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  const { actorId, roadmapId } = changes;
  const identity = { recipientId: actorId, roadmapId };
  const promoted = changes.facts.some(
    (fact) => fact.kind === 'participation-role' && fact.recipientId === actorId,
  );
  const completions = changes.facts.filter(
    (fact) => fact.kind === 'node-access' && fact.recipientId === actorId,
  );
  if (!promoted && !completions.length) return;
  await lockRecipientRoadmap(transaction, actorId, roadmapId);
  if (promoted) return rebaselineStaffAccess(transaction, identity);
  const role = (await roadmap.participants()).find(({ userId }) => userId === actorId)?.role;
  if (role !== 'STUDENT') return;
  const envelope = lazyRoadmapEnvelope(transaction, roadmapId);
  for (const fact of completions) {
    if (fact.kind !== 'node-access') continue;
    const target = nodeAccessTarget.target(fact, changes);
    const pending = await transaction.roadmapNotice.findFirst({
      where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
      select: { id: true },
    });
    if (pending) {
      // `currentAtEdit` already recorded the new state as the current value.
      await reconcileNoticeTarget(transaction, {
        descriptor: nodeAccessTarget,
        identity,
        target,
        fallbackKnown: fact.previous,
        roadmap,
        envelope,
        eventId: pending.id,
        occurredAt: new Date(),
      });
      continue;
    }
    // A deferred difference (Known value other than `previous`) stays to be told.
    await transaction.noticeKnownValue.updateMany({
      where: { ...identity, targetKey: target.targetKey, knownValue: fact.previous },
      data: { knownValue: fact.current, currentValue: fact.current },
    });
  }
}

async function rebaselineStaffAccess(
  transaction: Prisma.TransactionClient,
  identity: { recipientId: string; roadmapId: string },
) {
  const nodes = await transaction.roadmapNode.findMany({
    where: { roadmapId: identity.roadmapId },
    select: { id: true, isVisible: true, isTeacherBlocked: true },
  });
  const accessKeys = { startsWith: 'node:', endsWith: ':access' };
  await transaction.noticeKnownValue.deleteMany({ where: { ...identity, targetKey: accessKeys } });
  await transaction.noticeKnownValue.createMany({
    data: nodes.map((node) => {
      const state = nodeAccessState(node.isVisible, !node.isTeacherBlocked);
      return {
        ...identity,
        ...nodeAccessRef(node.id),
        knownValue: state,
        currentValue: state,
      };
    }),
  });
  await transaction.roadmapNotice.deleteMany({
    where: {
      ...identity,
      acknowledgedAt: null,
      data: { path: ['noticeTarget'], equals: nodeAccessTarget.noticeTarget },
    },
  });
}
