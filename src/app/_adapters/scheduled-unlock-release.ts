import 'server-only';

import { startAlignedPass } from './periodic-pass';

import { scheduledRoadmapChangePort } from './notice-change-port';
import { releaseScheduledTeacherUnlocks } from '@/features/roadmap/server';

const SCHEDULED_UNLOCK_SLOT_MS = 15 * 60_000;
const SCHEDULED_UNLOCK_MARGIN_MS = 5_000;

export async function releaseDueScheduledUnlocks(now?: Date) {
  await releaseScheduledTeacherUnlocks(scheduledRoadmapChangePort, now);
}

export function startScheduledUnlockRelease() {
  startAlignedPass({
    run: () => releaseDueScheduledUnlocks(),
    periodMs: SCHEDULED_UNLOCK_SLOT_MS,
    offsetMs: SCHEDULED_UNLOCK_MARGIN_MS,
    onError: (error) => console.warn('Scheduled unlock release failed', { error }),
  });
}
