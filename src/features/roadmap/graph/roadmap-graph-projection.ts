import type {
  RoadmapDependencyRequest,
  RoadmapDto,
  StudentRoadmapDto,
} from '@/features/roadmap/types';
import type { NodeActionIntent } from '@/features/roadmap/graph/node-action';

/**
 * The complete graph-editing capability. Its presence is the only thing that
 * enables editing mechanics; individual operations are not independently
 * configurable at this seam.
 */
export type RoadmapNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type RoadmapNodePlacement = {
  readonly nodeId: string;
  readonly position: RoadmapNodePosition;
};

export type RoadmapNodePositionCause = 'pointer' | 'keyboard' | 'automatic-layout';

export type RoadmapViewport = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

export type RoadmapGraphEditingIntent =
  | NodeActionIntent
  | {
      readonly kind: 'node-positions';
      readonly cause: RoadmapNodePositionCause;
      readonly positions: readonly RoadmapNodePlacement[];
    }
  | ({ readonly kind: 'create-dependency' } & RoadmapDependencyRequest)
  | {
      readonly kind: 'delete-dependencies';
      readonly dependencyIds: readonly string[];
    };

export type RoadmapGraphEditing = {
  onEditingIntent: (intent: RoadmapGraphEditingIntent) => void;
};

export type TeachingRoadmapGraphProjection = {
  kind: 'teaching';
  roadmap: RoadmapDto;
  editing?: RoadmapGraphEditing;
};

export type StudentRoadmapGraphProjection = {
  kind: 'student';
  roadmap: StudentRoadmapDto;
};

export type RoadmapGraphProjection = TeachingRoadmapGraphProjection | StudentRoadmapGraphProjection;
