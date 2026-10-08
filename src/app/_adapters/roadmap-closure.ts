import 'server-only';

import { closeDueRoadmaps } from '@/features/roadmap/server';
import { startPeriodicPass } from './periodic-pass';

/** Periodic pass in the persistent Node process; missed passes are safe to repeat. */
export function startRoadmapClosure() {
  startPeriodicPass({
    run: closeDueRoadmaps,
    intervalMs: process.env.ROADMAP_CLOSURE_INTERVAL_MS,
    onError: (error) => console.warn('Roadmap closure pass failed', { error }),
  });
}
