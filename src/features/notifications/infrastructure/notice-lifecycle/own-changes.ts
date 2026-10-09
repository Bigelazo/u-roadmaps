import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import { nodeAccessState } from '@/shared/node-access';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import type { RoadmapView } from '../../application/notice-targets';
import { nodeAccessRef, nodeAccessTarget } from '../../application/notice-targets/node-access';
import { reconcileNoticeTarget } from './reconcile';
import { lazyRoadmapEnvelope } from './recognize';
import type { RecipientRoadmap } from './known-values';

/**
 * Non-teaching events (ADR-0024), recorded inside the roadmap transaction:
 * - Completion: the student's own access transitions advance that student's Known
 *   values and update or withdraw their pending access notices; never a new notice.
 * - Promotion to teaching staff: re-baseline access to the staff view, withdraw access notices.
 * The actor rule for teaching staff (#208) is not applied here.
 */
function ownChanges({ actorId, facts }: RoadmapChanges) {
  return {
    promoted: facts.some(
      (fact) => fact.kind === 'participation-role' && fact.recipientId === actorId,
    ),
    completions: facts
      .filter(nodeAccessTarget.matches)
      .filter((fact) => fact.recipientId === actorId),
  };
}

/** Take the actor's recipient/Roadmap lock before any Known value of theirs is written. */
export async function lockOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
) {
  const { promoted, completions } = ownChanges(changes);
  if (promoted || completions.length)
    await lockRecipientRoadmap(transaction, changes.actorId, changes.roadmapId);
}

/** Callers hold the lock from `lockOwnChanges`. */
export async function recordOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
) {
  const { actorId, roadmapId } = changes;
  const identity = { recipientId: actorId, roadmapId };
  const { promoted, completions } = ownChanges(changes);
  if (promoted) return rebaselineStaffAccess(transaction, identity);
  const role = (await roadmap.participants()).find(({ userId }) => userId === actorId)?.role;
  if (role !== 'STUDENT' || !completions.length) return;
  const envelope = lazyRoadmapEnvelope(transaction, roadmapId);
  const occurredAt = new Date();
  for (const fact of completions) {
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
        eventId: randomUUID(),
        occurredAt,
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
  identity: RecipientRoadmap,
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
