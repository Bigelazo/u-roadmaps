import { type Edge, type EdgeTypes } from '@xyflow/react';
import { FloatingEdge } from '@/features/roadmap/graph/FloatingEdge';

export type RoadmapDependencyEdgeData = Record<string, unknown> & {
  defaultStroke: string;
  onDelete?: (dependencyId: string) => void;
};

export type RoadmapFlowEdge = Edge<RoadmapDependencyEdgeData, 'dependency'>;

export const roadmapEdgeTypes = { dependency: FloatingEdge } as EdgeTypes;
