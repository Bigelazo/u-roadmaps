import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type {
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  TargetContext,
} from '../../application/notice-targets';
import { descriptorForNoticeTarget, storedTargetValues } from '../../application/notice-targets';
import { reconcileTarget } from '../../application/reconcile-target';
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

type PendingNotice = NonNullable<
  Awaited<ReturnType<Prisma.TransactionClient['roadmapNotice']['findFirst']>>
>;
type CurrentTarget = NonNullable<Awaited<ReturnType<NoticeTargetDescriptor['current']>>>;
type Reconciliation = Exclude<ReturnType<typeof reconcileTarget>, { action: 'withdraw' }>;
type KnownTarget = Readonly<{
  knownValue: string;
  currentValue: string | null;
  context: Readonly<Record<string, unknown>>;
}>;
type PendingValues = NonNullable<ReturnType<typeof storedTargetValues>>['values'];

const unreadablePendingValues: PendingValues = { knownValue: '', currentValue: '', context: {} };

async function forgetTarget(
  transaction: Prisma.TransactionClient,
  { identity, target }: TargetReconciliationInput,
  pending: PendingNotice | null,
) {
  if (pending) await transaction.roadmapNotice.delete({ where: { id: pending.id } });
  await transaction.noticeKnownValue.deleteMany({
    where: { ...identity, targetKey: target.targetKey },
  });
}

async function knownTarget(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
): Promise<KnownTarget> {
  if (input.descriptor.keepsKnownValue === false)
    return {
      knownValue: input.fallbackKnown,
      currentValue: null,
      context: input.fallbackContext ?? {},
    };
  return ensureKnownValue(
    transaction,
    input.identity,
    input.target,
    input.fallbackKnown,
    input.fallbackContext,
  );
}

function pendingNoticeValues(pending: PendingNotice | null): PendingValues | null {
  if (!pending) return null;
  return storedTargetValues(pending.data)?.values ?? unreadablePendingValues;
}

function keepsPendingNotice(
  input: TargetReconciliationInput,
  result: Reconciliation,
  pending: PendingNotice | null,
  current: CurrentTarget,
) {
  if (result.action === 'no-op' && !(pending && input.absorbing)) return true;
  return !current.visible;
}

function noticeValues(
  input: TargetReconciliationInput,
  result: Reconciliation,
  pendingValues: PendingValues | null,
  current: CurrentTarget,
  known: KnownTarget,
) {
  const settled = result.action === 'no-op' ? pendingValues! : result;
  return {
    knownValue: settled.knownValue,
    currentValue: settled.currentValue,
    context: { ...pendingValues?.context, ...input.context, ...current.context },
    knownContext: known.context,
  };
}

function noticeOccurredAt(input: TargetReconciliationInput, pending: PendingNotice | null) {
  return new Date(Math.max(input.occurredAt.getTime(), pending?.occurredAt.getTime() ?? 0));
}

async function writeNotice(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
  pending: PendingNotice | null,
  values: ReturnType<typeof noticeValues>,
): Promise<string> {
  const { descriptor, identity, target } = input;
  const occurredAt = noticeOccurredAt(input, pending);
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
  const pending = await transaction.roadmapNotice.findFirst({
    where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
  });
  if (!current) {
    await forgetTarget(transaction, input, pending);
    return null;
  }
  const known = await knownTarget(transaction, input);
  const pendingValues = pendingNoticeValues(pending);
  const result = reconcileTarget({
    knownValue: known.knownValue,
    pending: pendingValues,
    currentValue: descriptor.currentAtEdit
      ? (known.currentValue ?? known.knownValue)
      : current.value,
  });
  if (result.action === 'withdraw') {
    await transaction.roadmapNotice.delete({ where: { id: pending!.id } });
    return null;
  }
  if (keepsPendingNotice(input, result, pending, current)) return pending?.id ?? null;
  return writeNotice(
    transaction,
    input,
    pending,
    noticeValues(input, result, pendingValues, current, known),
  );
}
