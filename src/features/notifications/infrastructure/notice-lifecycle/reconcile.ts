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
    if (pending) await transaction.roadmapNotice.delete({ where: { id: pending.id } });
    await transaction.noticeKnownValue.deleteMany({
      where: { ...identity, targetKey: target.targetKey },
    });
    return null;
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
  const pendingValues = pending
    ? (storedTargetValues(pending.data)?.values ?? {
        knownValue: '',
        currentValue: '',
        context: {},
      })
    : null;
  const result = reconcileTarget({
    knownValue: known.knownValue,
    pending: pendingValues,
    currentValue: input.descriptor.currentAtEdit
      ? (known.currentValue ?? known.knownValue)
      : current.value,
  });
  if (result.action === 'withdraw') {
    await transaction.roadmapNotice.delete({ where: { id: pending!.id } });
    return null;
  }
  if (result.action === 'no-op' && !(pending && input.absorbing)) return pending?.id ?? null;
  if (!current.visible) return pending?.id ?? null;
  const occurredAt = new Date(
    Math.max(input.occurredAt.getTime(), pending?.occurredAt.getTime() ?? 0),
  );
  const values = {
    knownValue: result.action === 'no-op' ? pendingValues!.knownValue : result.knownValue,
    currentValue: result.action === 'no-op' ? pendingValues!.currentValue : result.currentValue,
    context: { ...pendingValues?.context, ...input.context, ...current.context },
    knownContext: known.context,
  };
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
