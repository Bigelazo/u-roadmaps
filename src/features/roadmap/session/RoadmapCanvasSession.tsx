'use client';

import { RoadmapCanvasView } from '@/features/roadmap/session/RoadmapCanvasView';
import { RoadmapCanvasFeedbackProvider } from '@/features/roadmap/session/feedback';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

/**
 * The only public root for a Roadmap canvas interaction. The legacy-looking
 * view below is an internal composition detail; persistence and experience
 * capabilities are derived here from the session input.
 */
export function RoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  return (
    <RoadmapCanvasFeedbackProvider>
      <RoadmapCanvasView key={roadmapCanvasSessionKey(input)} input={input} />
    </RoadmapCanvasFeedbackProvider>
  );
}
