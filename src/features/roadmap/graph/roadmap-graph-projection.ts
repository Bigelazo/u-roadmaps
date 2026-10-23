import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { NodeActionIntent } from '@/features/roadmap/graph/node-action';

export type {
  RoadmapNodePlacement,
  RoadmapNodePosition,
} from '@/features/roadmap/canvas/commands/commands';

export type RoadmapViewport = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

export type RoadmapViewportRestoration = {
  readonly token: string;
  readonly viewport: RoadmapViewport;
};

export type RoadmapGraphEditingIntent =
  | NodeActionIntent
  | CanvasCommandOf<
      'move-nodes' | 'apply-automatic-layout' | 'create-dependency' | 'delete-dependencies'
    >;

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
