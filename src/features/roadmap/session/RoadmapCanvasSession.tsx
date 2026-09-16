'use client';

import { RoadmapCanvasView } from '@/features/roadmap/session/RoadmapCanvasView';
import {
  RoadmapCanvasSessionPersistenceProvider,
  httpRoadmapCanvasSessionPersistence,
  useRoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/session';
import { RoadmapCanvasFeedbackProvider } from '@/features/roadmap/session/feedback';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

/**
 * The only public root for a Roadmap canvas interaction. The legacy-looking
 * view below is an internal composition detail; persistence and experience
 * capabilities are derived here from the session input.
 */
export function RoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  const isTeaching = input.experience.kind === 'teaching';
  const isHistorical = input.experience.term === 'historical';
  const configuredPersistence = useRoadmapCanvasSessionPersistence();
  const view = (
    <RoadmapCanvasView
      key={roadmapCanvasSessionKey(input)}
      identifier={input.courseOffering.identifier}
      title={input.courseOffering.title}
      courseCode={input.courseOffering.identifier.courseCode}
      year={input.courseOffering.identifier.year}
      semester={input.courseOffering.identifier.semester}
      canEdit={isTeaching && !isHistorical}
      canPreview={isTeaching}
      isHistorical={isHistorical}
    />
  );

  const viewWithFeedback = <RoadmapCanvasFeedbackProvider>{view}</RoadmapCanvasFeedbackProvider>;

  return configuredPersistence ? (
    viewWithFeedback
  ) : (
    <RoadmapCanvasSessionPersistenceProvider persistence={httpRoadmapCanvasSessionPersistence}>
      {viewWithFeedback}
    </RoadmapCanvasSessionPersistenceProvider>
  );
}
