import { lockNoticeParticipation } from './participation-lock';
import { routeEffect } from '../application/route-effect';
import { reconcileStoredRoute } from './route-notice';
import 'server-only';
import { prisma, type Prisma } from '@/shared/server/db';
import type { NoticeEffect } from '../application/notice-effect';
import { projectDigestNotification } from '../digest-projection';
import { reconcileStoredTitle } from './title-notice';
import { reconcileStoredNodeContent } from './node-content-notice';
import { nodeContentEffect } from '../application/node-content-effect';
import { resourceEffect } from '../application/resource-effect';
import { reconcileStoredResource } from './resource-notice';
import { titleEffect } from '../application/title-effect';
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

/** Stores every accepted effect immediately; duplicates are rejected by NoticeDeliveryEffect. */
export async function deliverNotice(effect: NoticeEffect) {
  const accepted = await prisma.$transaction(async (transaction) => {
    // Serialize with Participation deactivation: it either deletes this delivery
    // after commit, or this transaction sees the loss and never stores it.
    const participation = await lockNoticeParticipation(
      transaction,
      effect.recipientId,
      effect.roadmapId,
    );
    if (
      !participation?.isActive ||
      (participation.noticeResetAt &&
        new Date(String(effect.payload.occurredAt)) <= participation.noticeResetAt)
    )
      return false;

    const accepted = await transaction.noticeDeliveryEffect.createMany({
      data: [{ eventId: effect.eventId, recipientId: effect.recipientId }],
      skipDuplicates: true,
    });
    if (!accepted.count) return false;
    if (await reconcileStoredAbsorption(transaction, effect)) return true;
    const route = routeEffect(effect);
    if (route) {
      await reconcileStoredRoute(transaction, route);
      return true;
    }
    const resource = resourceEffect(effect);
    if (resource) {
      await reconcileStoredResource(transaction, resource);
      return true;
    }
    const content = nodeContentEffect(effect);
    if (content) {
      await reconcileStoredNodeContent(transaction, content);
      return true;
    }
    const title = titleEffect(effect);
    if (title) {
      await reconcileStoredTitle(transaction, title);
      return true;
    }
    await transaction.roadmapNotice.createMany({
      data: [noticeRow(effect, projectDigestNotification(effect.payload, []))],
      skipDuplicates: true,
    });
    return true;
  });
  if (accepted) console.info('Roadmap notice saved', { noticeClass: effect.noticeClass });
}
