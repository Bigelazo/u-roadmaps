import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import type { Connection, OnConnectStart } from '@xyflow/react';
import { wouldCreateDependencyCycle } from '@/features/roadmap/domain/access';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';

type ConnectionPointerEvent = MouseEvent | TouchEvent | ReactMouseEvent | ReactTouchEvent;

function nodeUnderPointer(event: ConnectionPointerEvent) {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event;
  const target =
    typeof document.elementFromPoint === 'function' && point
      ? document.elementFromPoint(point.clientX, point.clientY)
      : event.target instanceof Element
        ? event.target
        : null;
  return target?.closest<HTMLElement>('.react-flow__node')?.dataset.id ?? null;
}

const touchLongPressDuration = 450;
const touchMovementTolerance = 8;
const interactiveNodeControl =
  'button, a, input, textarea, select, [role="button"], [role="menuitem"], [contenteditable="true"], .nodrag';

function isArrowModeControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-arrow-mode-controls]'));
}

function isOverArrowModeControl(event: ConnectionPointerEvent) {
  const point = 'changedTouches' in event ? event.changedTouches[0] : event;
  return (
    typeof document.elementFromPoint === 'function' &&
    Boolean(point) &&
    isArrowModeControl(document.elementFromPoint(point.clientX, point.clientY))
  );
}

type PendingTouch = {
  nodeId: string | null;
  x: number;
  y: number;
  armed: boolean;
};

/** Extends a handle-started gesture to the whole target Node, without changing Node dragging. */
export function useWholeNodeConnection({
  nodes,
  edges,
  enabled,
  onConnect,
}: {
  nodes: readonly RoadmapFlowNode[];
  edges: readonly RoadmapFlowEdge[];
  enabled: boolean;
  onConnect: (connection: Connection) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
  const [arrowPointer, setArrowPointer] = useState<{ x: number; y: number } | null>(null);
  const [arrowMessage, setArrowMessage] = useState('Modo flecha: toca un nodo de destino');
  const mobileSource = useRef<string | null>(null);
  const pendingTouch = useRef<PendingTouch | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const emitted = useRef(false);
  const suppressClick = useRef(false);
  const clickResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const dependencies = useMemo(
    () => edges.map((edge) => ({ sourceNodeId: edge.source, targetNodeId: edge.target })),
    [edges],
  );
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      if (!enabled || !connection.source || !connection.target) return false;
      const from = nodesById.get(connection.source);
      const to = nodesById.get(connection.target);
      return Boolean(
        from &&
        to &&
        !from.data.isHidden &&
        !to.data.isHidden &&
        !dependencies.some(
          (edge) => edge.sourceNodeId === from.id && edge.targetNodeId === to.id,
        ) &&
        !wouldCreateDependencyCycle(dependencies, from.id, to.id),
      );
    },
    [dependencies, enabled, nodesById],
  );
  const cancelPendingTouch = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    pendingTouch.current = null;
  }, []);
  const cancelArrowMode = useCallback(() => {
    cancelPendingTouch();
    mobileSource.current = null;
    setArrowSourceId(null);
    setArrowPointer(null);
    setTargetId(null);
    setArrowMessage('Modo flecha: toca un nodo de destino');
  }, [cancelPendingTouch]);
  useEffect(() => {
    if (!arrowSourceId) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelArrowMode();
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  }, [arrowSourceId, cancelArrowMode]);
  useEffect(() => {
    const activeId = mobileSource.current ?? pendingTouch.current?.nodeId;
    if (
      activeId &&
      (!enabled || !nodesById.has(activeId) || nodesById.get(activeId)?.data.isHidden)
    )
      cancelArrowMode();
  }, [cancelArrowMode, enabled, nodesById]);
  const suppressDropClick = useCallback((duration = 0) => {
    suppressClick.current = true;
    if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
    clickResetTimer.current = setTimeout(() => {
      suppressClick.current = false;
    }, duration);
  }, []);
  const chooseMobileTarget = useCallback(
    (target: string | null) => {
      const from = mobileSource.current;
      if (!from) return;
      if (!target) {
        cancelArrowMode();
        return;
      }
      if (!isValidConnection({ source: from, target })) {
        setArrowMessage('Elige otro nodo visible que permita esta dependencia');
        setTargetId(null);
        setArrowPointer(null);
        return;
      }
      cancelArrowMode();
      onConnect({ source: from, target, sourceHandle: null, targetHandle: null });
    },
    [cancelArrowMode, isValidConnection, onConnect],
  );
  const onConnectStart: OnConnectStart = useCallback(
    (_event, parameters) => {
      if (!enabled || !parameters.nodeId) return;
      cancelArrowMode();
      source.current = { nodeId: parameters.nodeId, handleId: parameters.handleId };
      emitted.current = false;
      setTargetId(null);
    },
    [cancelArrowMode, enabled],
  );
  const completeConnection = useCallback(
    (connection: Connection) => {
      if ((source.current && emitted.current) || !isValidConnection(connection)) return;
      emitted.current = true;
      onConnect(connection);
    },
    [isValidConnection, onConnect],
  );
  const onPointerMove = useCallback(
    (event: ReactMouseEvent | ReactTouchEvent) => {
      const touch = 'changedTouches' in event ? event.changedTouches[0] : null;
      const candidateTouch = pendingTouch.current;
      if (
        touch &&
        candidateTouch &&
        !candidateTouch.armed &&
        Math.hypot(touch.clientX - candidateTouch.x, touch.clientY - candidateTouch.y) >
          touchMovementTolerance
      )
        cancelPendingTouch();
      if (mobileSource.current) {
        // React delegates touchmove passively; the pane's touch-action already blocks browser panning.
        if (!('changedTouches' in event)) event.preventDefault();
        event.stopPropagation();
        const point = touch ?? ('clientX' in event ? event : null);
        if (point) setArrowPointer({ x: point.clientX, y: point.clientY });
        const candidate = nodeUnderPointer(event);
        setTargetId(
          isValidConnection({ source: mobileSource.current, target: candidate }) ? candidate : null,
        );
        return;
      }
      if (!source.current) return;
      const candidate = nodeUnderPointer(event);
      setTargetId(
        isValidConnection({ source: source.current.nodeId, target: candidate }) ? candidate : null,
      );
    },
    [cancelPendingTouch, isValidConnection],
  );
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = source.current;
      if (!start) return;
      if (!emitted.current) {
        const target = nodeUnderPointer(event);
        if (target)
          completeConnection({
            source: start.nodeId,
            sourceHandle: start.handleId,
            target,
            targetHandle: null,
          });
      }
      source.current = null;
      setTargetId(null);
      // A drop over a title, type icon, or action button must not also open it.
      suppressDropClick();
    },
    [completeConnection, suppressDropClick],
  );

  const onTouchStartCapture = useCallback(
    (event: ReactTouchEvent) => {
      if (isArrowModeControl(event.target)) return;
      // A fresh touch is intentional input, distinct from the previous touch's compatibility click.
      suppressClick.current = false;
      if (clickResetTimer.current) clearTimeout(clickResetTimer.current);
      if (event.touches.length !== 1) {
        cancelArrowMode();
        return;
      }
      const point = event.touches[0];
      if (mobileSource.current) {
        event.stopPropagation();
        pendingTouch.current = {
          nodeId: nodeUnderPointer(event),
          x: point.clientX,
          y: point.clientY,
          armed: false,
        };
        return;
      }
      if (
        !enabled ||
        !(event.target instanceof Element) ||
        event.target.closest(interactiveNodeControl)
      )
        return;
      const nodeId = nodeUnderPointer(event);
      if (!nodeId || !nodesById.has(nodeId) || nodesById.get(nodeId)?.data.isHidden) return;
      cancelPendingTouch();
      const candidate: PendingTouch = { nodeId, x: point.clientX, y: point.clientY, armed: false };
      pendingTouch.current = candidate;
      longPressTimer.current = setTimeout(() => {
        candidate.armed = true;
        mobileSource.current = nodeId;
        setArrowSourceId(nodeId);
        setArrowPointer(null);
        setTargetId(null);
        setArrowMessage('Modo flecha: toca un nodo de destino');
        longPressTimer.current = null;
      }, touchLongPressDuration);
    },
    [cancelArrowMode, cancelPendingTouch, enabled, nodesById],
  );

  const onTouchEndCapture = useCallback(
    (event: ReactTouchEvent) => {
      if (isArrowModeControl(event.target)) return;
      if (event.touches.length > 0) return;
      const gesture = pendingTouch.current;
      cancelPendingTouch();
      if (!mobileSource.current) return;
      event.preventDefault();
      // Let the native drag listener clean up its original touch, while preventing its click.
      suppressDropClick(500);
      const candidate = nodeUnderPointer(event);
      setArrowPointer(null);
      // The controls can appear under the finger that armed the mode: lifting it is no choice.
      if (gesture?.armed && (candidate === mobileSource.current || isOverArrowModeControl(event)))
        return;
      chooseMobileTarget(candidate);
    },
    [cancelPendingTouch, chooseMobileTarget, suppressDropClick],
  );

  return {
    targetId,
    arrowSourceId,
    arrowPointer,
    arrowMessage,
    cancelArrowMode,
    onTouchStartCapture,
    onTouchEndCapture,
    onTouchCancelCapture: cancelArrowMode,
    onContextMenuCapture: (event: ReactMouseEvent) => {
      if (!pendingTouch.current && !mobileSource.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
    isValidConnection,
    onConnectStart,
    onConnect: completeConnection,
    onConnectEnd,
    onPointerMove,
    onClickCapture: (event: ReactMouseEvent) => {
      if (isArrowModeControl(event.target)) return;
      if (!suppressClick.current && !mobileSource.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      chooseMobileTarget(nodeUnderPointer(event));
    },
  };
}
