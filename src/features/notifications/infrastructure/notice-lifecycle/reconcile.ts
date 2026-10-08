import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type {
  NoticeTargetDescriptor,
  NoticeTargetRef,
  RoadmapView,
  TargetContext,
} from '../../application/notice-targets';
import { storedTargetValues } from '../../application/notice-targets';
import { reconcileTarget } from '../../application/reconcile-target';
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
  /** Loaded only when a notice is written. */
  envelope: () => Promise<NoticeEnvelope>;
  eventId: string;
  occurredAt: Date;
}>;

/**
 * The single reconciliation path: compare the target's live value with the
 * recipient's Known value and pending notice, then withdraw, keep, update in
 * place (same notice id) or create. Callers hold the recipient/Roadmap lock.
 */
export async function reconcileNoticeTarget(
  transaction: Prisma.TransactionClient,
  input: TargetReconciliationInput,
) {
  const { descriptor, identity, target } = input;
  const current = await descriptor.current(target, input.roadmap);
  if (!current) return;
  const known = await ensureKnownValue(
    transaction,
    identity,
    target,
    input.fallbackKnown,
    input.fallbackContext,
  );
  const pending = await transaction.roadmapNotice.findFirst({
    where: { ...identity, targetKey: target.targetKey, acknowledgedAt: null },
  });
  // A pending row without stored values can only be replaced in place.
  const pendingValues = pending
    ? (storedTargetValues(pending.data)?.values ?? { knownValue: '', currentValue: '' })
    : null;
  const result = reconcileTarget({
    knownValue: known.knownValue,
    pending: pendingValues,
    currentValue: current.value,
  });
  if (result.action === 'no-op') return;
  if (result.action === 'withdraw') {
    await transaction.roadmapNotice.delete({ where: { id: pending!.id } });
    return;
  }
  if (!current.visible) return;
  const occurredAt = new Date(
    Math.max(input.occurredAt.getTime(), pending?.occurredAt.getTime() ?? 0),
  );
  const values = {
    knownValue: result.knownValue,
    currentValue: result.currentValue,
    // An unchanged current value keeps the context it was announced with (e.g. type
    // names at assignment, even after a rename).
    context:
      pendingValues && 'context' in pendingValues && pendingValues.currentValue === current.value
        ? pendingValues.context
        : (current.context ?? {}),
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
      ...values,
      occurredAt: occurredAt.toISOString(),
      eventCount: 1,
      digestKey: input.eventId,
    } as Prisma.InputJsonObject,
    occurredAt,
    availableAt: occurredAt,
  };
  if (result.action === 'update') {
    await transaction.roadmapNotice.update({ where: { id: pending!.id }, data: row });
    return;
  }
  await transaction.roadmapNotice.create({
    data: {
      ...row,
      ...identity,
      targetKey: target.targetKey,
      eventId: input.eventId,
      courseOfferingId: envelope.courseOfferingId,
    },
  });
}
