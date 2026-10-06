import 'server-only';

import { deliverRoadmapNodeNotifications } from '@/app/_adapters/roadmap-node-notifications';
import {
  releaseScheduledTeacherUnlocks,
  SCHEDULED_UNLOCK_ACTOR_ID,
} from '@/features/roadmap/server';

const DEFAULT_INTERVAL_MS = 5 * 60_000;

function intervalMs() {
  const configured = Number(process.env.SCHEDULED_UNLOCK_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : DEFAULT_INTERVAL_MS;
}

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
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void releaseDueScheduledUnlocks()
      .catch(() => console.warn('Scheduled unlock release failed'))
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, intervalMs()).unref();
}
