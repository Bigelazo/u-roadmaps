'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import { memo, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
  type ReactFlowState,
} from '@xyflow/react';
import { floatingEdgeGeometry, type NodeRect } from '@/features/roadmap/graph/geometry';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { Button } from '@/shared/ui/button';

function nodeRect(state: ReactFlowState, nodeId: string): NodeRect | null {
  const node = state.nodeLookup.get(nodeId);
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) return null;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, width, height };
}

function sameRect(a: NodeRect | null, b: NodeRect | null) {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Arista que elige sus extremos según la posición relativa de los nodos, en vez
 * de quedar clavada a los conectores guardados en la dependencia.
 */
export const FloatingEdge = memo(function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  selected,
  style,
  interactionWidth,
  data,
}: EdgeProps<RoadmapFlowEdge>) {
  const sourceRect = useStore(
    useCallback((state: ReactFlowState) => nodeRect(state, source), [source]),
    sameRect,
  );
  const targetRect = useStore(
    useCallback((state: ReactFlowState) => nodeRect(state, target), [target]),
    sameRect,
  );

  if (!sourceRect || !targetRect) return null;

  const [path, labelX, labelY] = getSmoothStepPath({
    ...floatingEdgeGeometry(sourceRect, targetRect),
    borderRadius: 8,
  });

  const onDelete = data?.onDelete;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      {selected && onDelete ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label="Eliminar dependencia"
                    className="rounded-full border border-destructive/20 shadow-sm hover:shadow-md"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(id);
                    }}
                  >
                    <X data-icon="inline-start" aria-hidden="true" />
                  </Button>
                }
              />
              <TooltipContent>Eliminar dependencia</TooltipContent>
            </Tooltip>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

FloatingEdge.displayName = 'FloatingEdge';
