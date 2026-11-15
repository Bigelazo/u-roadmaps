import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@/shared/server/db';
import type { RoadmapChangeFact, RoadmapChanges } from '@/shared/roadmap-changes';
import { lockRecipientRoadmap } from '@/shared/server/recipient-roadmap-lock';
import {
  descriptorForFact,
  type NoticeTargetDescriptor,
  type NoticeTargetRef,
  type TargetContext,
} from '../../application/notice-targets';
import { acceptDelivery } from '../notice-delivery';
import { nodeCreationRef } from '../../application/absorption';
import {
  forgetDeletedNode,
  recordKnowersValueAtEdit,
  recordKnownValues,
  recordRecipientKnownValues,
} from './known-values';
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
  const { access } = changes;
  const roadmap = roadmapView(
    transaction,
    changes.roadmapId,
    readAccess,
    access ? async () => access : readRoadmapAccess,
  );
  await lockOwnChanges(transaction, changes);
  const recorded: { order: number; target?: RecordedTarget; own?: OwnTarget }[] = [];
  const fromFacts: FactRecipientTarget[] = [];
  for (const [order, fact] of changes.facts.entries()) {
    const descriptor = descriptorForFact(fact);
    if (!descriptor) continue;
    const target = descriptor.target(fact, changes);
    const previousValue = descriptor.previousValue(fact);
    const previousContext = descriptor.previousContext?.(fact);
    const factRecipients = descriptor.factRecipients?.(fact);
    if (factRecipients) {
      fromFacts.push({
        order,
        descriptor,
        fact,
        target,
        previousValue,
        previousContext,
        factRecipients,
      });
      continue;
    }
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
      requireKnowers(descriptor, knowers, atEdit.recipientIds);
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
    recorded.push({
      order,
      own: audience.includes(changes.actorId)
        ? { descriptor, fact, target, previousValue }
        : undefined,
      target:
        recipientIds.length || unawareRecipientIds.length
          ? {
              descriptor,
              target,
              previousValue,
              previousContext,
              context: descriptor.factContext?.(fact, changes),
              recipientIds,
              unawareRecipientIds,
            }
          : undefined,
    });
  }
  recorded.push(...(await recordFactRecipientTargets(transaction, changes, fromFacts)));
  recorded.sort((a, b) => a.order - b.order);
  const targets = recorded.flatMap(({ target }) => (target ? [target] : []));
  const ownTargets = recorded.flatMap(({ own }) => (own ? [own] : []));
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

type FactRecipientTarget = Readonly<{
  order: number;
  descriptor: NoticeTargetDescriptor;
  fact: RoadmapChangeFact;
  target: NoticeTargetRef;
  previousValue: string;
  previousContext?: TargetContext;
  factRecipients: readonly string[];
}>;

function requireKnowers(
  descriptor: NoticeTargetDescriptor,
  knowers: readonly string[],
  editedRecipientIds: readonly string[],
) {
  const knowerIds = new Set(knowers);
  if (editedRecipientIds.some((recipientId) => !knowerIds.has(recipientId)))
    throw new Error(`${descriptor.noticeTarget}: currentAtEdit names a non-knower.`);
}

async function recordFactRecipientTargets(
  transaction: Prisma.TransactionClient,
  changes: RoadmapChanges,
  fromFacts: readonly FactRecipientTarget[],
) {
  await recordRecipientKnownValues(
    transaction,
    changes.roadmapId,
    fromFacts.flatMap(
      ({ descriptor, fact, target, previousValue, previousContext, factRecipients }) => {
        const atEdit = descriptor.currentAtEdit?.(fact);
        if (atEdit) requireKnowers(descriptor, factRecipients, atEdit.recipientIds);
        const edited = new Set(atEdit?.recipientIds);
        return factRecipients.map((recipientId) => ({
          recipientId,
          target,
          knownValue: previousValue,
          context: previousContext ?? {},
          currentValue: atEdit && edited.has(recipientId) ? atEdit.value : undefined,
        }));
      },
    ),
  );
  return fromFacts.map(
    ({ order, descriptor, fact, target, previousValue, previousContext, factRecipients }) => {
      const recipientIds = factRecipients.filter((recipientId) => recipientId !== changes.actorId);
      return {
        order,
        own: factRecipients.includes(changes.actorId)
          ? { descriptor, fact, target, previousValue }
          : undefined,
        target: recipientIds.length
          ? {
              descriptor,
              target,
              previousValue,
              previousContext,
              context: descriptor.factContext?.(fact, changes),
              recipientIds,
              unawareRecipientIds: [],
            }
          : undefined,
      };
    },
  );
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
