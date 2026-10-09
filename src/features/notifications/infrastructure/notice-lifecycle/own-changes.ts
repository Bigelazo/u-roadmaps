import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/shared/server/db';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { nodeAccessState } from '@/shared/node-access';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import {
  descriptorForFact,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type RoadmapView,
} from '../../application/notice-targets';
import { nodeAccessRef, nodeAccessTarget } from '../../application/notice-targets/node-access';
import { reconcileNoticeTarget } from './reconcile';
import { lazyRoadmapEnvelope } from './recognize';
import { setKnownValue, type RecipientRoadmap } from './known-values';

/** A target the actor's change touched and the actor sees (the actor is in its audience). */
export type OwnTarget = Readonly<{
  descriptor: NoticeTargetDescriptor;
  fact: RoadmapChangeFact;
  target: NoticeTargetRef;
  previousValue: string;
}>;

const promoted = ({ actorId, facts }: RoadmapChanges) =>
  facts.some((fact) => fact.kind === 'participation-role' && fact.recipientId === actorId);

/**
 * Take the actor's recipient/Roadmap lock before any Known value of theirs may be written
 * (whether the actor is in a target's audience is only known later, so any notice-bearing
 * change takes it). Other recipients' locks are taken only at delivery, in their own
 * transactions, so this is the only advisory lock the roadmap transaction holds.
 */
export async function lockOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
) {
  if (promoted(changes) || changes.facts.some((fact) => descriptorForFact(fact)))
    await lockRecipientRoadmap(transaction, changes.actorId, changes.roadmapId);
}

/**
 * The actor rule (ADR-0024), recorded inside the roadmap transaction after every
 * target's Known values: the actor's own change advances the actor's Known value; a
 * pending notice of the actor's for that target absorbs the change instead (withdrawn
 * on a return to the Known value). The actor never gets a new notice for it. Completion
 * is the case of a student's own access transition.
 * Promotion to teaching staff re-baselines access to the staff view instead.
 * Callers hold the lock from `lockOwnChanges`.
 */
export async function recordOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
  ownTargets: readonly OwnTarget[],
) {
  const identity = { recipientId: changes.actorId, roadmapId: changes.roadmapId };
  if (promoted(changes)) return rebaselineStaffAccess(transaction, identity);
  const envelope = lazyRoadmapEnvelope(transaction, changes.roadmapId);
  const occurredAt = new Date();
  for (const { descriptor, fact, target, previousValue } of ownTargets) {
    if (descriptor.keepsKnownValue === false) continue;
    const pending = await transaction.roadmapNotice.findFirst({
      where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
      select: { id: true },
    });
    if (pending) {
      await reconcileNoticeTarget(transaction, {
        descriptor,
        identity,
        target,
        fallbackKnown: previousValue,
        fallbackContext: descriptor.previousContext?.(fact),
        roadmap,
        envelope,
        eventId: randomUUID(),
        occurredAt,
      });
      continue;
    }
    const current = await descriptor.current(target, roadmap, identity.recipientId);
    if (!current) continue;
    // The actor now knows the value they produced, so an untold earlier difference is
    // superseded (Known value includes "the one they produced themselves").
    // Targets recorded at edit time (Node access) take the value the change reported.
    const value = descriptor.currentAtEdit?.(fact).value ?? current.value;
    await setKnownValue(transaction, identity, target, value, current.context);
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
