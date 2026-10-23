'use client';

import { RoadmapCanvasView } from '@/features/roadmap/session/RoadmapCanvasView';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

export function RoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  return (
    <RoadmapCanvasView
      key={`${roadmapCanvasSessionKey(input)}:${input.roadmapEntryKey ?? ''}`}
      input={input}
    />
  );
}
