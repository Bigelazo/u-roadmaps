import 'server-only';

import { startPeriodicPass } from './periodic-pass';

import { deliverRoadmapNodeNotifications } from '@/app/_adapters/roadmap-node-notifications';
import {
  releaseScheduledTeacherUnlocks,
  SCHEDULED_UNLOCK_ACTOR_ID,
} from '@/features/roadmap/server';

async function releaseDueScheduledUnlocks() {
  const released = await releaseScheduledTeacherUnlocks().match(
    (value) => value,
    (error) => {
      console.warn('Scheduled unlock release failed', { code: error.code });
      return [];
    },
  );
  for (const { identifier, notifications } of released) {
    await deliverRoadmapNodeNotifications(
      {
        actorId: SCHEDULED_UNLOCK_ACTOR_ID,
        identifier,
        notifications,
      },
      (persist) => persist(),
    );
  }
}

/**
 * Periodically releases Scheduled unlocks from the single persistent Node process.
 * Each pass is idempotent, so a late or repeated pass only releases what is due.
 */
export function startScheduledUnlockRelease() {
  startPeriodicPass({
    run: releaseDueScheduledUnlocks,
    intervalMs: process.env.SCHEDULED_UNLOCK_INTERVAL_MS,
    onError: () => console.warn('Scheduled unlock release failed'),
  });
}
