import 'server-only';
import { after } from 'next/server';
import type { RoadmapChangePort } from '@/features/roadmap/server';
import {
  recordRoadmapNotices,
  type NoticeDeliveryScheduler,
} from '@/features/notifications/server';

/** One composition for HTTP, pages, and the scheduled pass; no global registration. */
function noticesPort(scheduleDelivery: NoticeDeliveryScheduler): RoadmapChangePort {
  return {
    async report(transaction, changes) {
      if (!changes.facts.length) return;
      const delivery = await recordRoadmapNotices(transaction, changes);
      return delivery && (() => delivery(scheduleDelivery));
    },
  };
}

export const roadmapChangePort = noticesPort(after);

/** The Scheduled unlock pass has no request: it delivers immediately. */
export const scheduledRoadmapChangePort = noticesPort((persist) => persist());
