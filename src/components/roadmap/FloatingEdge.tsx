'use client';

import { useCallback } from 'react';
import {
  BaseEdge,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
  type ReactFlowState,
} from '@xyflow/react';
import { floatingEdgeGeometry, type NodeRect } from '@/lib/roadmap-geometry';

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
export function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) {
  const sourceRect = useStore(
    useCallback((state: ReactFlowState) => nodeRect(state, source), [source]),
    sameRect,
  );
  const targetRect = useStore(
    useCallback((state: ReactFlowState) => nodeRect(state, target), [target]),
    sameRect,
  );

  if (!sourceRect || !targetRect) return null;

  const [path] = getSmoothStepPath({
    ...floatingEdgeGeometry(sourceRect, targetRect),
    borderRadius: 8,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth}
    />
  );
}
