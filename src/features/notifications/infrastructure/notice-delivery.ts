import { lockNoticeParticipation } from './participation-lock';
import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import type { NoticeEffect } from '../application/notice-effect';
import { projectDigestNotification } from '../digest-projection';
import { reconcileStoredAbsorption } from './absorption-notice';

function noticeRow(effect: NoticeEffect, projection: ReturnType<typeof projectDigestNotification>) {
  return {
    eventId: effect.eventId,
    recipientId: effect.recipientId,
    roadmapId: effect.roadmapId,
    courseOfferingId: effect.courseOfferingId,
    occurredAt: new Date(String(effect.payload.occurredAt)),
    ...projection,
    data: {
      ...effect.payload,
      ...projection.data,
      noticeClass: effect.noticeClass,
    } as Prisma.InputJsonObject,
  };
}

/**
 * Accept one delivery to one recipient, or reject it when the Participation is
 * inactive, the change predates its notice reset, or the delivery is a retry.
 */
export async function acceptDelivery(
  transaction: Prisma.TransactionClient,
  delivery: { eventId: string; recipientId: string; roadmapId: string; occurredAt: Date },
) {
  // Serialize with Participation deactivation: it either deletes this delivery
  // after commit, or this transaction sees the loss and never stores it.
  const participation = await lockNoticeParticipation(
    transaction,
    delivery.recipientId,
    delivery.roadmapId,
  );
  if (
    !participation?.isActive ||
    (participation.noticeResetAt && delivery.occurredAt <= participation.noticeResetAt)
  )
    return false;
  const accepted = await transaction.noticeDeliveryEffect.createMany({
    data: [{ eventId: delivery.eventId, recipientId: delivery.recipientId }],
    skipDuplicates: true,
  });
  return accepted.count > 0;
}

/** Stores every accepted effect immediately; duplicates are rejected by NoticeDeliveryEffect. */
export async function deliverNotice(effect: NoticeEffect) {
  const accepted = await prisma.$transaction(async (transaction) => {
    if (
      !(await acceptDelivery(transaction, {
        ...effect,
        occurredAt: new Date(String(effect.payload.occurredAt)),
      }))
    )
      return false;
    if (await reconcileStoredAbsorption(transaction, effect)) return true;
    await transaction.roadmapNotice.createMany({
      data: [noticeRow(effect, projectDigestNotification(effect.payload, []))],
      skipDuplicates: true,
    });
    return true;
  });
  if (accepted) console.info('Roadmap notice saved', { noticeClass: effect.noticeClass });
}
