import 'server-only';

import { startPeriodicPass } from './periodic-pass';

import { scheduledRoadmapChangePort } from './roadmap-changes';
import { releaseScheduledTeacherUnlocks } from '@/features/roadmap/server';

async function releaseDueScheduledUnlocks() {
  await releaseScheduledTeacherUnlocks(scheduledRoadmapChangePort).match(
    () => undefined,
    (error) => {
      console.warn('Scheduled unlock release failed', { code: error.code });
    },
  );
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
