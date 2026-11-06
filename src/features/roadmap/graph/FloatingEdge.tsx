'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import { memo } from 'react';
import { X } from 'lucide-react';
import { EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { useDependencyRoute } from '@/features/roadmap/graph/routing/DependencyRouting';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { Button } from '@/shared/ui/button';
import { AnimatedDependencyPath } from '@/features/roadmap/graph/DependencyAnimation';

export const FloatingEdge = memo(function FloatingEdge({
  id,
  selected,
  style,
  interactionWidth,
  data,
}: EdgeProps<RoadmapFlowEdge>) {
  const route = useDependencyRoute(id);
  if (!route) return null;
  const {
    path,
    label: { x: labelX, y: labelY },
  } = route;

  const onDelete = data?.onDelete;

  return (
    <>
      <AnimatedDependencyPath id={id} path={path} style={style} />
      {interactionWidth !== 0 ? (
        <path
          d={path}
          className="react-flow__edge-interaction"
          fill="none"
          strokeOpacity={0}
          strokeWidth={interactionWidth ?? 20}
        />
      ) : null}
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
