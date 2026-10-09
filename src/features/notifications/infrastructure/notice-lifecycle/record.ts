import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import {
  descriptorForFact,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type TargetContext,
} from '../../application/notice-targets';
import { acceptDelivery } from '../notice-delivery';
import { forgetDeletedNode, recordCurrentValues, recordKnownValues } from './known-values';
import { roadmapView, type NodeAccessReader } from './roadmap-view';
import { reconcileNoticeTarget } from './reconcile';
import { noticeCourseContext, type NoticeCourseContext } from './course-context';
import { lockOwnChanges, recordOwnChanges, type OwnTarget } from './own-changes';

/** Runs a recorded change's delivery work once the roadmap transaction has committed. */
export type NoticeDeliveryScheduler = (task: () => Promise<void>) => void | Promise<void>;

/** Deferred delivery of one recorded Roadmap change; safe to retry. */
export type NoticeDelivery = (schedule: NoticeDeliveryScheduler) => Promise<void>;

type RecordedTarget = Readonly<{
  descriptor: NoticeTargetDescriptor;
  target: NoticeTargetRef;
  previousValue: string;
  previousContext?: TargetContext;
  context?: Readonly<Record<string, unknown>>;
  recipientIds: readonly string[];
}>;

const DELIVERY_CONCURRENCY = 5;

/**
 * (A) Record, inside the roadmap transaction: fix every recipient's Known value
 * before the change is visible, decide the audience, and return the delivery.
 */
export async function recordNoticeTargets(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  accessibleNodes?: NodeAccessReader,
): Promise<NoticeDelivery | undefined> {
  const roadmap = roadmapView(transaction, changes.roadmapId, accessibleNodes);
  await lockOwnChanges(transaction, changes);
  const targets: RecordedTarget[] = [];
  const ownTargets: OwnTarget[] = [];
  for (const fact of changes.facts) {
    const descriptor = descriptorForFact(fact);
    if (!descriptor) continue;
    const target = descriptor.target(fact, changes);
    const previousValue = descriptor.previousValue(fact);
    const previousContext = descriptor.previousContext?.(fact);
    await recordKnownValues(
      transaction,
      changes.roadmapId,
      target,
      await descriptor.knowers(fact, changes, roadmap),
      previousValue,
      previousContext,
    );
    const atEdit = descriptor.currentAtEdit?.(fact);
    if (atEdit)
      await recordCurrentValues(
        transaction,
        changes.roadmapId,
        target,
        atEdit.recipientIds,
        atEdit.value,
      );
    const audience = await descriptor.audience(fact, changes, roadmap);
    if (audience.includes(changes.actorId))
      ownTargets.push({ descriptor, fact, target, previousValue });
    let recipientIds = audience.filter((recipientId) => recipientId !== changes.actorId);
    if (fact.kind === 'node-deleted') {
      // Settled here, not at delivery, so a delivery that never runs leaves nothing behind.
      recipientIds = await forgetDeletedNode(
        transaction,
        changes.roadmapId,
        fact.nodeId,
        recipientIds,
      );
    }
    if (recipientIds.length)
      targets.push({
        descriptor,
        target,
        previousValue,
        previousContext,
        context: descriptor.factContext?.(fact, changes),
        recipientIds,
      });
  }
  await recordOwnChanges(transaction, changes, roadmap, ownTargets);
  if (!targets.length) return undefined;
  const eventId = randomUUID();
  const occurredAt = new Date();
  return async (schedule) => {
    try {
      const courseContext = await noticeCourseContext(prisma, changes.roadmapId, changes.actorId);
      if (!courseContext) return;
      await schedule(() =>
        deliverTargets(targets, { eventId, occurredAt, courseContext, accessibleNodes }),
      );
    } catch {
      console.warn('Roadmap notice delivery failed', { roadmapId: changes.roadmapId });
    }
  };
}

type RecordedChange = Readonly<{
  eventId: string;
  occurredAt: Date;
  courseContext: NoticeCourseContext;
  accessibleNodes?: NodeAccessReader;
}>;

async function deliverTargets(targets: readonly RecordedTarget[], change: RecordedChange) {
  const deliveries = targets.flatMap((target) =>
    target.recipientIds.map((recipientId) => () => deliverTarget(target, recipientId, change)),
  );
  let failed = false;
  // Bound recipient transactions without dropping later recipients on failure.
  for (let offset = 0; offset < deliveries.length; offset += DELIVERY_CONCURRENCY) {
    const results = await Promise.allSettled(
      deliveries.slice(offset, offset + DELIVERY_CONCURRENCY).map((deliver) => deliver()),
    );
    failed ||= results.some((result) => result.status === 'rejected');
  }
  if (failed)
    console.warn('Roadmap notice delivery failed', { roadmapId: change.courseContext.roadmapId });
}

/** (B) Deliver to one recipient in its own transaction, in the shared lock order. */
async function deliverTarget(
  { descriptor, target, previousValue, previousContext, context }: RecordedTarget,
  recipientId: string,
  { eventId, occurredAt, courseContext, accessibleNodes }: RecordedChange,
) {
  const { roadmapId } = courseContext;
  const targetEventId = `${eventId}:${target.targetKey}`;
  await prisma.$transaction(async (transaction) => {
    if (
      !(await acceptDelivery(transaction, {
        eventId: targetEventId,
        recipientId,
        roadmapId,
        occurredAt,
      }))
    )
      return;
    await lockRecipientRoadmap(transaction, recipientId, roadmapId);
    // A concurrent deletion of the target's Node settles it in the roadmap transaction
    // (see `forgetDeletedNode`): wait for that transaction so this delivery sees the outcome.
    if (target.nodeId)
      await transaction.$queryRaw`SELECT 1 FROM "RoadmapNode" WHERE id = ${target.nodeId}::uuid FOR SHARE`;
    await reconcileNoticeTarget(transaction, {
      descriptor,
      identity: { recipientId, roadmapId },
      target,
      fallbackKnown: previousValue,
      fallbackContext: previousContext,
      context,
      roadmap: roadmapView(transaction, roadmapId, accessibleNodes),
      courseContext: async () => courseContext,
      eventId: targetEventId,
      occurredAt,
    });
  });
}
