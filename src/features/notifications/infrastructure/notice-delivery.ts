import { lockNoticeParticipation } from './participation-lock';
import 'server-only';
import type { Prisma } from '@/shared/server/db';

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
