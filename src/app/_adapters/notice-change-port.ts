import 'server-only';
import type { RoadmapChangePort } from '@/features/roadmap/server';
import {
  recordRoadmapNotices,
  type NoticeDeliveryScheduler,
} from '@/features/notifications/server';

export function noticesPort(scheduleDelivery: NoticeDeliveryScheduler): RoadmapChangePort {
  return {
    async report(transaction, changes) {
      if (!changes.facts.length) return;
      const delivery = await recordRoadmapNotices(transaction, changes);
      return delivery && (() => delivery(scheduleDelivery));
    },
  };
}

export const scheduledRoadmapChangePort = noticesPort((persist) => persist());
