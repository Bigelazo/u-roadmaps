import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import { createNoticeGrouper, type NoticeEffect } from '../application/group-notices';
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

// Next can bundle separate route entry points. Share windows across those modules.
const processDelivery = globalThis as typeof globalThis & {
  ownNoticeGrouper?: ReturnType<typeof createNoticeGrouper>;
};

function grouper() {
  processDelivery.ownNoticeGrouper ??= createNoticeGrouper({
    accept: (effect, immediate) =>
      prisma.$transaction(async (transaction) => {
        const accepted = await transaction.noticeDeliveryEffect.createMany({
          data: [{ eventId: effect.eventId, recipientId: effect.recipientId }],
          skipDuplicates: true,
        });
        if (!accepted.count) return false;
        if (immediate) {
          await transaction.roadmapNotice.createMany({
            data: [
              noticeRow(
                effect,
                projectDigestNotification(effect.payload, [], { unlimitedStrings: true }),
              ),
            ],
            skipDuplicates: true,
          });
        }
        return true;
      }),
    publish: async (effect, projection) => {
      // The same table/transactional INSERT trigger signals first notices and summaries.
      await prisma.roadmapNotice.createMany({
        data: [noticeRow(effect, projection)],
        skipDuplicates: true,
      });
    },
    failed: () => console.warn('Roadmap change summary delivery failed'),
  });
  return processDelivery.ownNoticeGrouper;
}

export function deliverGroupedNotice(effect: NoticeEffect) {
  return grouper().deliver(effect);
}
