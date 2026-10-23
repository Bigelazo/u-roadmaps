import 'server-only';

import { startPeriodicPass } from './periodic-pass';

import { scheduledRoadmapChangePort } from './roadmap-changes';
import { releaseScheduledTeacherUnlocks } from '@/features/roadmap/server';

async function releaseDueScheduledUnlocks() {
  await releaseScheduledTeacherUnlocks(scheduledRoadmapChangePort);
}

export function startScheduledUnlockRelease() {
  startPeriodicPass({
    run: releaseDueScheduledUnlocks,
    intervalMs: process.env.SCHEDULED_UNLOCK_INTERVAL_MS,
    onError: (error) => console.warn('Scheduled unlock release failed', { error }),
  });
}
