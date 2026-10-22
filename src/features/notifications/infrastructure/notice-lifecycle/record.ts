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
import { nodeCreationRef } from '../../application/absorption';
import { forgetDeletedNode, recordKnowersValueAtEdit, recordKnownValues } from './known-values';
import {
  roadmapView,
  type ParticipantAccessReader,
  type RoadmapAccessReader,
} from './roadmap-view';
import { reconcileNoticeTarget } from './reconcile';
import { noticeCourseContext, type NoticeCourseContext } from './course-context';
import { lockOwnChanges, recordOwnChanges, type OwnTarget } from './own-changes';

export type NoticeDeliveryScheduler = (task: () => Promise<void>) => void | Promise<void>;

export type NoticeDelivery = (schedule: NoticeDeliveryScheduler) => Promise<void>;

type RecordedTarget = Readonly<{
  descriptor: NoticeTargetDescriptor;
  target: NoticeTargetRef;
  previousValue: string;
  previousContext?: TargetContext;
  context?: Readonly<Record<string, unknown>>;
  recipientIds: readonly string[];
  unawareRecipientIds?: readonly string[];
}>;

const DELIVERY_CONCURRENCY = 5;

export async function recordNoticeTargets(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  readAccess?: ParticipantAccessReader,
  readRoadmapAccess?: RoadmapAccessReader,
): Promise<NoticeDelivery | undefined> {
  const roadmap = roadmapView(transaction, changes.roadmapId, readAccess, readRoadmapAccess);
  await lockOwnChanges(transaction, changes);
  const targets: RecordedTarget[] = [];
  const ownTargets: OwnTarget[] = [];
  for (const fact of changes.facts) {
    const descriptor = descriptorForFact(fact);
    if (!descriptor) continue;
    const target = descriptor.target(fact, changes);
    const previousValue = descriptor.previousValue(fact);
    const previousContext = descriptor.previousContext?.(fact);
    const knowers = await descriptor.knowers(fact, changes, roadmap);
    await recordKnownValues(
      transaction,
      changes.roadmapId,
      target,
      knowers,
      previousValue,
      previousContext,
    );
    const atEdit = descriptor.currentAtEdit?.(fact);
    if (atEdit) {
      const knowerIds = new Set(knowers);
      if (atEdit.recipientIds.some((recipientId) => !knowerIds.has(recipientId)))
        throw new Error(`${descriptor.noticeTarget}: currentAtEdit names a non-knower.`);
      await recordKnowersValueAtEdit(
        transaction,
        changes.roadmapId,
        target,
        atEdit.recipientIds,
        previousValue,
        atEdit.value,
      );
    }
    const audience = await descriptor.audience(fact, changes, roadmap);
    if (audience.includes(changes.actorId))
      ownTargets.push({ descriptor, fact, target, previousValue });
    let recipientIds = audience.filter((recipientId) => recipientId !== changes.actorId);
    let unawareRecipientIds: string[] = [];
    if (fact.kind === 'node-deleted') {
      const settled = await forgetDeletedNode(
        transaction,
        changes.roadmapId,
        fact.nodeId,
        recipientIds,
      );
      recipientIds = settled.aware;
      unawareRecipientIds = settled.unaware;
    }
    if (recipientIds.length || unawareRecipientIds.length)
      targets.push({
        descriptor,
        target,
        previousValue,
        previousContext,
        context: descriptor.factContext?.(fact, changes),
        recipientIds,
        unawareRecipientIds,
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
        deliverTargets(targets, { eventId, occurredAt, courseContext, readAccess }),
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
  readAccess?: ParticipantAccessReader;
}>;

async function deliverTargets(targets: readonly RecordedTarget[], change: RecordedChange) {
  const deliveries = targets.flatMap((target) => [
    ...target.recipientIds.map((recipientId) => () => deliverTarget(target, recipientId, change)),
    ...(target.unawareRecipientIds ?? []).map(
      (recipientId) => () => withdrawCreation(target, recipientId, change),
    ),
  ]);
  let failed = false;
  for (let offset = 0; offset < deliveries.length; offset += DELIVERY_CONCURRENCY) {
    const results = await Promise.allSettled(
      deliveries.slice(offset, offset + DELIVERY_CONCURRENCY).map((deliver) => deliver()),
    );
    failed ||= results.some((result) => result.status === 'rejected');
  }
  if (failed)
    console.warn('Roadmap notice delivery failed', { roadmapId: change.courseContext.roadmapId });
}

async function deliverTarget(
  { descriptor, target, previousValue, previousContext, context }: RecordedTarget,
  recipientId: string,
  { eventId, occurredAt, courseContext, readAccess }: RecordedChange,
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
    await reconcileNoticeTarget(transaction, {
      descriptor,
      identity: { recipientId, roadmapId },
      target,
      fallbackKnown: previousValue,
      fallbackContext: previousContext,
      context,
      roadmap: roadmapView(transaction, roadmapId, readAccess),
      courseContext: async () => courseContext,
      eventId: targetEventId,
      occurredAt,
    });
  });
}

async function withdrawCreation(
  { target }: RecordedTarget,
  recipientId: string,
  { courseContext }: RecordedChange,
) {
  if (!target.nodeId) return;
  const { roadmapId } = courseContext;
  await prisma.$transaction(async (transaction) => {
    await lockRecipientRoadmap(transaction, recipientId, roadmapId);
    await transaction.roadmapNotice.deleteMany({
      where: {
        recipientId,
        roadmapId,
        targetKey: nodeCreationRef(target.nodeId!).targetKey,
        acknowledgedAt: null,
      },
    });
  });
}
