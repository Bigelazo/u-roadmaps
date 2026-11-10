import 'server-only';

import { startAlignedPass } from './periodic-pass';

import { syncAcademicCalendar } from '@/features/roadmap/server';
import { fixtureEnvironmentEnabled } from '@/shared/server/environment/development';

const ACADEMIC_CALENDAR_SYNC_PERIOD_MS = 24 * 60 * 60_000;
const ACADEMIC_CALENDAR_SYNC_OFFSET_MS = 13 * 60 * 60_000;

export function startAcademicCalendarSync() {
  if (fixtureEnvironmentEnabled()) return;
  startAlignedPass({
    run: async () => {
      const outcome = await syncAcademicCalendar();
      if (outcome.status === 'synced') {
        console.info('Academic calendar synced', outcome.term);
      }
    },
    periodMs: ACADEMIC_CALENDAR_SYNC_PERIOD_MS,
    offsetMs: ACADEMIC_CALENDAR_SYNC_OFFSET_MS,
    onError: (error) => console.warn('Academic calendar sync failed', { error }),
  });
}
