import { useReducer } from 'react';
import { canvasStateReducer, initialCanvasState } from '@/features/roadmap/canvas/state';
import {
  useRoadmapCanvasSession,
  type RoadmapCanvasSessionOptions,
} from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

export function useTestCanvasSession(
  input: RoadmapCanvasSessionInput,
  options: Omit<RoadmapCanvasSessionOptions, 'canvas'> = {},
) {
  const [state, dispatch] = useReducer(canvasStateReducer, initialCanvasState);
  return useRoadmapCanvasSession(input, { ...options, canvas: { state, dispatch } });
}
