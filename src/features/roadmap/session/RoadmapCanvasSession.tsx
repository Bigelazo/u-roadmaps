'use client';

import { useState } from 'react';
import { prepareRoutingEngine } from '@/features/roadmap/graph/routing/libavoid';
import { RoadmapCanvasView } from '@/features/roadmap/session/RoadmapCanvasView';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

export function RoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  // The graph itself mounts only after the Roadmap is fetched; this runs in the initial HTML.
  useState(prepareRoutingEngine);
  return (
    <RoadmapCanvasView
      key={`${roadmapCanvasSessionKey(input)}:${input.roadmapEntryKey ?? ''}`}
      input={input}
    />
  );
}
