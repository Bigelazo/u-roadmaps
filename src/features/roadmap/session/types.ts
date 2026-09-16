import type { CourseOfferingIdentifier, StudentRoadmapDto } from '@/features/roadmap/types';

export type RoadmapCanvasExperience =
  | { readonly kind: 'student'; readonly term: 'current' | 'historical' }
  | { readonly kind: 'teaching'; readonly term: 'current' | 'historical' };

export type RoadmapCanvasSessionInput = {
  readonly courseOffering: {
    readonly identifier: CourseOfferingIdentifier;
    readonly title: string;
  };
  readonly experience: RoadmapCanvasExperience;
};

export type RoadmapCanvasSessionPersistence = {
  load(input: RoadmapCanvasSessionInput): Promise<StudentRoadmapDto>;
  complete(input: RoadmapCanvasSessionInput, nodeId: string): Promise<void>;
};
