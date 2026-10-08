import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@/shared/server/db';
import type { RoadmapChanges } from '@/shared/roadmap-changes';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import {
  descriptorForFact,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
} from '../../application/notice-targets';
import { acceptDelivery } from '../notice-delivery';
import { reconcileStoredAbsorption } from '../absorption-notice';
import type { NoticeDeliveryScheduler } from '../own-inbox';
import { forgetNodeKnownValues, recordKnownValues } from './known-values';
import { roadmapView, type NodeAccessReader } from './roadmap-view';
import { reconcileNoticeTarget, type NoticeEnvelope } from './reconcile';
import { roadmapEnvelope } from './envelope';

/** Deferred delivery of one recorded Roadmap change; safe to retry. */
export type NoticeDelivery = (schedule: NoticeDeliveryScheduler) => Promise<void>;

type RecordedTarget = Readonly<{
  descriptor: NoticeTargetDescriptor;
  target: NoticeTargetRef;
  previousValue: string;
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
  const targets: RecordedTarget[] = [];
  for (const fact of changes.facts) {
    if (fact.kind === 'node-deleted')
      await forgetNodeKnownValues(transaction, changes.roadmapId, fact.nodeId);
    const descriptor = descriptorForFact(fact);
    if (!descriptor) continue;
    const target = descriptor.target(fact);
    const previousValue = descriptor.previousValue(fact);
    await recordKnownValues(
      transaction,
      changes.roadmapId,
      target,
      await descriptor.knowers(fact, changes, roadmap),
      previousValue,
    );
    const recipientIds = (await descriptor.audience(fact, changes, roadmap)).filter(
      (recipientId) => recipientId !== changes.actorId,
    );
    if (recipientIds.length) targets.push({ descriptor, target, previousValue, recipientIds });
  }
  if (!targets.length) return undefined;
  const eventId = randomUUID();
  const occurredAt = new Date();
  return async (schedule) => {
    try {
      const envelope = await roadmapEnvelope(prisma, changes.roadmapId, changes.actorId);
      if (!envelope) return;
      await schedule(() =>
        deliverTargets(targets, { eventId, occurredAt, envelope, accessibleNodes }),
      );
    } catch {
      console.warn('Roadmap notice delivery failed', { roadmapId: changes.roadmapId });
    }
  };
}

type RecordedChange = Readonly<{
  eventId: string;
  occurredAt: Date;
  envelope: NoticeEnvelope;
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
    console.warn('Roadmap notice delivery failed', { roadmapId: change.envelope.roadmapId });
}

/** (B) Deliver to one recipient in its own transaction, in the shared lock order. */
async function deliverTarget(
  { descriptor, target, previousValue }: RecordedTarget,
  recipientId: string,
  { eventId, occurredAt, envelope, accessibleNodes }: RecordedChange,
) {
  const { roadmapId } = envelope;
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
    // Until absorption moves into the module, broad notices absorb through the old stack.
    if (
      await reconcileStoredAbsorption(transaction, {
        eventId: targetEventId,
        recipientId,
        roadmapId,
        courseOfferingId: envelope.courseOfferingId,
        noticeClass: descriptor.noticeClass,
        payload: {
          ...envelope,
          ...(target.nodeId ? { nodeId: target.nodeId } : {}),
          ...descriptor.readSide,
          occurredAt: occurredAt.toISOString(),
          eventCount: 1,
          digestKey: targetEventId,
        },
      })
    )
      return;
    await reconcileNoticeTarget(transaction, {
      descriptor,
      identity: { recipientId, roadmapId },
      target,
      fallbackKnown: previousValue,
      roadmap: roadmapView(transaction, roadmapId, accessibleNodes),
      envelope: async () => envelope,
      eventId: targetEventId,
      occurredAt,
    });
  });
}
