import { createContext, useContext } from 'react';
import {
  getSmoothStepPath,
  useReactFlow,
  ViewportPortal,
  type ConnectionLineComponentProps,
} from '@xyflow/react';
import {
  floatingEdgeGeometry,
  nearestSide,
  nodeCenter,
  sideAnchor,
  type NodeRect,
  type Point,
} from '@/features/roadmap/graph/geometry';
import { useConnectionPreviewRoute } from '@/features/roadmap/graph/routing/DependencyRouting';
import { DependencyPath } from '@/features/roadmap/graph/DependencyPath';

export const ConnectionTargetContext = createContext<(NodeRect & { id: string }) | null>(null);

function sourceTowardsPointer(source: NodeRect, point: Point) {
  const sourcePosition = nearestSide(nodeCenter(source), point);
  const anchor = sideAnchor(source, sourcePosition);
  return { sourceX: anchor.x, sourceY: anchor.y, sourcePosition };
}

export function ConnectionPreview({
  fromNode,
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  pointer,
}: ConnectionLineComponentProps) {
  const target = useContext(ConnectionTargetContext);
  const routedPath = useConnectionPreviewRoute(fromNode.id, target?.id ?? null);
  const { getViewport } = useReactFlow();
  const viewport = getViewport();
  // React Flow converts `to` to flow coordinates, but leaves `pointer` canvas-local.
  const point = {
    x: (pointer.x - viewport.x) / viewport.zoom,
    y: (pointer.y - viewport.y) / viewport.zoom,
  };
  const { width, height } = fromNode.measured;
  const sourceRect =
    width && height ? { ...fromNode.internals.positionAbsolute, width, height } : null;
  const sourceGeometry = sourceRect
    ? sourceTowardsPointer(sourceRect, point)
    : { sourceX: fromX, sourceY: fromY, sourcePosition: fromPosition };
  const [freePath] = getSmoothStepPath({
    ...sourceGeometry,
    targetX: toX,
    targetY: toY,
    targetPosition: sourceRect ? nearestSide(point, nodeCenter(sourceRect)) : toPosition,
    borderRadius: 8,
  });
  const path = target ? routedPath : freePath;
  if (!path) return null;
  return (
    <DependencyPath
      className="react-flow__connection-path"
      path={path}
      style={{ stroke: 'var(--primary)', strokeWidth: 1.5, pointerEvents: 'none' }}
    />
  );
}

/** Touch arrow mode shares the route geometry without starting a native handle drag. */
export function TouchConnectionPreview({
  source,
  sourceId,
  target,
  targetId,
  pointer,
}: {
  source: NodeRect;
  sourceId: string;
  targetId?: string | null;
  target: NodeRect | null;
  pointer: { x: number; y: number } | null;
}) {
  const routedPath = useConnectionPreviewRoute(sourceId, targetId ?? null);
  const { screenToFlowPosition } = useReactFlow();
  const point = pointer ? screenToFlowPosition(pointer, { snapToGrid: false }) : null;
  if (!target && !point) return null;
  if (
    !target &&
    point &&
    point.x >= source.x &&
    point.x <= source.x + source.width &&
    point.y >= source.y &&
    point.y <= source.y + source.height
  )
    return null;
  const geometry = floatingEdgeGeometry(source, {
    x: point?.x ?? 0,
    y: point?.y ?? 0,
    width: 0,
    height: 0,
  });
  const [freePath] = getSmoothStepPath({
    ...geometry,
    ...sourceTowardsPointer(source, point ?? nodeCenter(target!)),
    borderRadius: 8,
  });
  const path = target ? routedPath : freePath;
  if (!path) return null;
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className="roadmap-connection-preview pointer-events-none absolute top-0 left-0 overflow-visible"
        width={1}
        height={1}
      >
        <DependencyPath
          path={path}
          className="react-flow__connection-path"
          style={{ stroke: 'var(--primary)', strokeWidth: 1.5, pointerEvents: 'none' }}
        />
      </svg>
    </ViewportPortal>
  );
}
