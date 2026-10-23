import { lockNoticeParticipation } from './participation-lock';
import 'server-only';
import type { Prisma } from '@/shared/server/db';

export async function acceptDelivery(
  transaction: Prisma.TransactionClient,
  delivery: { eventId: string; recipientId: string; roadmapId: string; occurredAt: Date },
) {
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
