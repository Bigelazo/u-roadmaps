import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type {
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  TargetContext,
  TargetValues,
} from '../../application/notice-targets';
import { descriptorForNoticeTarget, storedTargetValues } from '../../application/notice-targets';
import { absorbs, containingTargets } from '../../application/absorption';
import { ensureKnownValue, type RecipientRoadmap } from './known-values';
import type { NoticeCourseContext } from './course-context';

export type TargetReconciliationInput = Readonly<{
  descriptor: NoticeTargetDescriptor;
  identity: RecipientRoadmap;
  target: NoticeTargetRef;
  fallbackKnown: string;
  fallbackContext?: TargetContext;
  roadmap: RoadmapView;
  context?: Readonly<Record<string, unknown>>;
  courseContext: () => Promise<NoticeCourseContext>;
  eventId: string;
  occurredAt: Date;
  absorbing?: boolean;
}>;

type ReconciliationScope = 'identity' | 'roadmap' | 'courseContext';

function pendingNotice(
  transaction: Prisma.TransactionClient,
  identity: RecipientRoadmap,
  targetKey: string,
) {
  return transaction.roadmapNotice.findFirst({
    where: { ...identity, targetKey, acknowledgedAt: null },
  });
}

export function reconcileFor(
  transaction: Prisma.TransactionClient,
  {
    eventId,
    occurredAt,
    ...scope
  }: Pick<TargetReconciliationInput, ReconciliationScope> & {
    eventId: (targetKey: string) => string;
    occurredAt?: Date;
  },
) {
  return {
    hasPending: async (targetKey: string) =>
      Boolean(
        await transaction.roadmapNotice.findFirst({
          where: { ...scope.identity, targetKey, acknowledgedAt: null },
          select: { id: true },
        }),
      ),
    reconcile: (
      input: Omit<TargetReconciliationInput, ReconciliationScope | 'eventId' | 'occurredAt'>,
    ) =>
      reconcileNoticeTarget(transaction, {
        ...scope,
        ...input,
        eventId: eventId(input.target.targetKey),
        occurredAt: occurredAt ?? new Date(),
      }),
  };
}

export const valueToCompare = (
  descriptor: NoticeTargetDescriptor,
  known: Readonly<{ knownValue: string; currentValue: string | null }>,
  current: Readonly<{ value: string }>,
) => (descriptor.currentAtEdit ? (known.currentValue ?? known.knownValue) : current.value);

export async function reconcileNoticeTarget(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
) {
  for (const broad of containingTargets(input.identity.roadmapId, input.target)) {
    const known = await transaction.noticeKnownValue.findUnique({
      where: {
        recipientId_roadmapId_targetKey: { ...input.identity, targetKey: broad.targetKey },
      },
      select: { knownValue: true },
    });
    const descriptor = descriptorForNoticeTarget(broad.noticeTarget);
    if (!descriptor || !absorbs(known?.knownValue)) continue;
    await reconcileInScope(transaction, {
      ...input,
      descriptor,
      target: broad,
      fallbackKnown: known!.knownValue,
      fallbackContext: undefined,
      context: undefined,
      absorbing: true,
    });
    return;
  }
  await reconcileInScope(transaction, input);
}

async function reconcileInScope(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
) {
  const noticeId = await reconcileOne(transaction, input);
  const scope = input.descriptor.scope;
  if (!noticeId || !scope) return;
  await transaction.roadmapNotice.deleteMany({
    where: {
      ...input.identity,
      acknowledgedAt: null,
      id: { not: noticeId },
      ...(scope === 'node' ? { data: { path: ['nodeId'], equals: input.target.nodeId! } } : {}),
    },
  });
}

type PendingNotice = NonNullable<Awaited<ReturnType<typeof pendingNotice>>>;

async function writeNotice(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
  pending: PendingNotice | null,
  values: TargetValues,
): Promise<string> {
  const { descriptor, identity, target } = input;
  const occurredAt = new Date(
    Math.max(input.occurredAt.getTime(), pending?.occurredAt.getTime() ?? 0),
  );
  const wording = descriptor.wording(values);
  const courseContext = await input.courseContext();
  const row = {
    subject: wording.subject,
    body: wording.body,
    data: {
      ...courseContext,
      ...(target.nodeId ? { nodeId: target.nodeId } : {}),
      targetKey: target.targetKey,
      noticeClass: descriptor.noticeClass,
      noticeTarget: descriptor.noticeTarget,
      ...descriptor.storedData?.(target),
      ...values,
      occurredAt: occurredAt.toISOString(),
      eventCount: 1,
      digestKey: input.eventId,
    } as Prisma.InputJsonObject,
    occurredAt,
    availableAt: occurredAt,
  };
  if (pending) {
    await transaction.roadmapNotice.update({ where: { id: pending.id }, data: row });
    return pending.id;
  }
  const created = await transaction.roadmapNotice.create({
    data: {
      ...row,
      ...identity,
      targetKey: target.targetKey,
      eventId: input.eventId,
      courseOfferingId: courseContext.courseOfferingId,
    },
    select: { id: true },
  });
  return created.id;
}

async function reconcileOne(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
): Promise<string | null> {
  const { descriptor, identity, target } = input;
  const current = await descriptor.current(target, input.roadmap, identity.recipientId);
  const pending = await pendingNotice(transaction, identity, target.targetKey);
  const withdraw = async () => {
    if (pending) await transaction.roadmapNotice.delete({ where: { id: pending.id } });
    return null;
  };
  if (!current) {
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: target.targetKey },
    });
    return withdraw();
  }
  const known =
    descriptor.keepsKnownValue === false
      ? {
          knownValue: input.fallbackKnown,
          currentValue: null,
          context: input.fallbackContext ?? {},
        }
      : await ensureKnownValue(
          transaction,
          identity,
          target,
          input.fallbackKnown,
          input.fallbackContext,
        );
  const { knownValue } = known;
  const currentValue = valueToCompare(descriptor, known, current);
  if (currentValue === knownValue) return withdraw();
  const pendingValues = pending && storedTargetValues(pending.data)?.values;
  const unchanged =
    pendingValues?.knownValue === knownValue && pendingValues.currentValue === currentValue;
  if ((unchanged && !input.absorbing) || !current.visible) return pending?.id ?? null;
  return writeNotice(transaction, input, pending, {
    knownValue,
    currentValue,
    context: { ...pendingValues?.context, ...input.context, ...current.context },
    knownContext: known.context,
  });
}
