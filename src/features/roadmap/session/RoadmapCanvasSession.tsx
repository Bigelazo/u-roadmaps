'use client';

import RoadmapCanvas from '@/features/roadmap/RoadmapCanvas';
import {
  RoadmapCanvasSessionPersistenceProvider,
  httpRoadmapCanvasSessionPersistence,
  useRoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/session';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

function sessionKey(input: RoadmapCanvasSessionInput) {
  const { courseCode, year, semester } = input.courseOffering.identifier;
  return `${courseCode}:${year}:${semester}:${input.experience.kind}:${input.experience.term}`;
}

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
    <RoadmapCanvas
      key={sessionKey(input)}
      identifier={input.courseOffering.identifier}
      title={input.courseOffering.title}
      courseCode={input.courseOffering.identifier.courseCode}
      year={input.courseOffering.identifier.year}
      semester={input.courseOffering.identifier.semester}
      canEdit={isTeaching && !isHistorical}
      canPreview={isTeaching}
      isHistorical={isHistorical}
      renderFeedbackOutsideGraph
    />
  );

  return configuredPersistence ? (
    view
  ) : (
    <RoadmapCanvasSessionPersistenceProvider persistence={httpRoadmapCanvasSessionPersistence}>
      {view}
    </RoadmapCanvasSessionPersistenceProvider>
  );
}
