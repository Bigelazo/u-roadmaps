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
import { lazyNoticeCourseContext } from './course-context';
import { advanceKnownValue, type RecipientRoadmap } from './known-values';

export type OwnTarget = Readonly<{
  descriptor: NoticeTargetDescriptor;
  fact: RoadmapChangeFact;
  target: NoticeTargetRef;
  previousValue: string;
}>;

const promoted = ({ actorId, facts }: RoadmapChanges) =>
  facts.some((fact) => fact.kind === 'participation-role' && fact.recipientId === actorId);

export async function lockOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
) {
  if (promoted(changes) || changes.facts.some((fact) => descriptorForFact(fact)))
    await lockRecipientRoadmap(transaction, changes.actorId, changes.roadmapId);
}

export async function recordOwnChanges(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  roadmap: RoadmapView,
  ownTargets: readonly OwnTarget[],
) {
  const identity = { recipientId: changes.actorId, roadmapId: changes.roadmapId };
  if (promoted(changes)) return rebaselineStaffAccess(transaction, identity, roadmap);
  const courseContext = lazyNoticeCourseContext(transaction, changes.roadmapId);
  const occurredAt = new Date();
  for (const { descriptor, fact, target, previousValue } of ownTargets) {
    if (descriptor.keepsKnownValue === false) continue;
    const pending = await transaction.roadmapNotice.findFirst({
      where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
      select: { id: true },
    });
    const reconcile = () =>
      reconcileNoticeTarget(transaction, {
        descriptor,
        identity,
        target,
        fallbackKnown: previousValue,
        fallbackContext: descriptor.previousContext?.(fact),
        roadmap,
        courseContext,
        eventId: randomUUID(),
        occurredAt,
      });
    if (pending) {
      await reconcile();
      continue;
    }
    const current = await descriptor.current(target, roadmap, identity.recipientId);
    if (!current) continue;
    const value = descriptor.currentAtEdit?.(fact).value ?? current.value;
    const advanced = await advanceKnownValue(
      transaction,
      identity,
      target,
      previousValue,
      value,
      current.context,
    );
    if (!advanced) await reconcile();
  }
}

async function rebaselineStaffAccess(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  roadmap: RoadmapView,
) {
  const [nodes, accessible] = await Promise.all([
    roadmap.nodes(),
    roadmap.accessibleNodeIds(identity.recipientId),
  ]);
  await transaction.noticeKnownValue.deleteMany({
    where: { ...identity, noticeTarget: nodeAccessTarget.noticeTarget },
  });
  await transaction.noticeKnownValue.createMany({
    data: nodes.map((node) => {
      const state = nodeAccessState(node.isVisible, accessible.has(node.id));
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
