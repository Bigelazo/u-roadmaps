import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import type { NoticeEffect } from '../application/notice-effect';
import { projectDigestNotification } from '../digest-projection';

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

/** Stores every accepted effect immediately; duplicates are rejected by NoticeDeliveryEffect. */
export async function deliverNotice(effect: NoticeEffect) {
  const accepted = await prisma.$transaction(async (transaction) => {
    const accepted = await transaction.noticeDeliveryEffect.createMany({
      data: [{ eventId: effect.eventId, recipientId: effect.recipientId }],
      skipDuplicates: true,
    });
    if (!accepted.count) return false;
    await transaction.roadmapNotice.createMany({
      data: [noticeRow(effect, projectDigestNotification(effect.payload, []))],
      skipDuplicates: true,
    });
    return true;
  });
  if (accepted) console.info('Roadmap notice saved', { noticeClass: effect.noticeClass });
}
