import { X } from 'lucide-react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import { Button } from '@/components/ui/button';

export type RoadmapDependencyEdgeData = Record<string, unknown> & {
  defaultStroke: string;
  onDelete?: (dependencyId: string) => void;
};

export type RoadmapFlowEdge = Edge<RoadmapDependencyEdgeData, 'dependency'>;

function RoadmapDependencyEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  selected,
  style,
  data,
}: EdgeProps<RoadmapFlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && data?.onDelete ? (
        <EdgeLabelRenderer>
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            className="nodrag nopan absolute -translate-x-1/2 -translate-y-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              data.onDelete?.(id);
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const roadmapEdgeTypes = { dependency: RoadmapDependencyEdge } as EdgeTypes;
