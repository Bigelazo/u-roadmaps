import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type {
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  TargetContext,
} from '../../application/notice-targets';
import { descriptorForTargetKey, storedTargetValues } from '../../application/notice-targets';
import { reconcileTarget } from '../../application/reconcile-target';
import { absorbs, containingTargets } from '../../application/absorption';
import { ensureKnownValue, type RecipientRoadmap } from './known-values';

/** Course context every stored notice carries for navigation and the read side. */
export type NoticeEnvelope = Readonly<{
  roadmapId: string;
  courseOfferingId: string;
  courseCode: string;
  year: number;
  semester: number;
  courseName: string;
  actorId?: string;
  actorName?: string;
}>;

export type TargetReconciliationInput = Readonly<{
  descriptor: NoticeTargetDescriptor;
  identity: RecipientRoadmap;
  target: NoticeTargetRef;
  /** Known value (and its context) to record when the recipient has no baseline yet. */
  fallbackKnown: string;
  fallbackContext?: TargetContext;
  roadmap: RoadmapView;
  /** Context the change itself reported (see `NoticeTargetDescriptor.factContext`). */
  context?: Readonly<Record<string, unknown>>;
  /** Loaded only when a notice is written. */
  envelope: () => Promise<NoticeEnvelope>;
  eventId: string;
  occurredAt: Date;
  /** A change inside this broad target: rewrite its pending notice even if its values held. */
  absorbing?: boolean;
}>;

/**
 * Reconcile a target within the hierarchy Roadmap ⊃ Node ⊃ aspect/Resource: a broad
 * target the recipient has not recognized absorbs the change (its notice is brought up
 * to date instead); a broad notice, once written, replaces the pending notices it
 * contains. Callers hold the recipient/Roadmap lock.
 */
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
    if (!absorbs(known?.knownValue)) continue;
    await reconcileInScope(transaction, {
      ...input,
      descriptor: descriptorForTargetKey(broad.targetKey)!,
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

/**
 * The single reconciliation path: compare the target's live value with the
 * recipient's Known value and pending notice, then withdraw, keep, update in
 * place (same notice id) or create. Returns the pending notice left, if any.
 */
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
    // The target no longer exists: nothing is left to tell or to compare.
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
  // A pending row without stored values can only be replaced in place.
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
    // Targets recorded at edit time reconcile against that state (it may be newer than
    // this delivery, never older than the recorded change).
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
    // Live context wins over the change's, which wins over what the pending notice kept.
    context: { ...pendingValues?.context, ...input.context, ...current.context },
    knownContext: known.context,
  };
  const wording = descriptor.wording(values);
  const envelope = await input.envelope();
  const row = {
    // Text is projected at read time; the columns keep a cache of it.
    subject: wording.subject,
    body: wording.body,
    data: {
      ...envelope,
      ...(target.nodeId ? { nodeId: target.nodeId } : {}),
      targetKey: target.targetKey,
      noticeClass: descriptor.noticeClass,
      noticeTarget: descriptor.noticeTarget,
      ...descriptor.readSide,
      ...descriptor.valueReadSide?.(values),
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
      courseOfferingId: envelope.courseOfferingId,
    },
    select: { id: true },
  });
  return created.id;
}
