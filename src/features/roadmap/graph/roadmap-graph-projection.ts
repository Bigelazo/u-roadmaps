import type { Connection, OnNodeDrag } from '@xyflow/react';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { NodeActionCallbacks } from '@/features/roadmap/graph/node-action';

/**
 * The complete graph-editing capability. Its presence is the only thing that
 * enables editing mechanics; individual operations are not independently
 * configurable at this seam.
 */
export type RoadmapGraphEditing = Required<NodeActionCallbacks> & {
  onMoveNode: OnNodeDrag<RoadmapFlowNode>;
  onConnectNodes: (connection: Connection) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
  onAutoLayout: (nodes: RoadmapFlowNode[]) => void;
  onKeyboardNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
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
