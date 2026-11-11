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
import { dependencyRejection, type DependencyRejection } from '@/features/roadmap/domain/access';
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

export type ConnectionRejection = {
  reason: Exclude<DependencyRejection, 'SELF_DEPENDENCY'>;
  source: RoadmapFlowNode;
  target: RoadmapFlowNode;
};

export const arrowModeMessage = 'Modo flecha: toca un nodo de destino';

type PendingTouch = {
  nodeId: string | null;
  x: number;
  y: number;
  armed: boolean;
};

export function useWholeNodeConnection({
  nodes,
  edges,
  enabled,
  onConnect,
  onReject,
}: {
  nodes: readonly RoadmapFlowNode[];
  edges: readonly RoadmapFlowEdge[];
  enabled: boolean;
  onConnect: (connection: Connection) => void;
  onReject: (rejection: ConnectionRejection) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rejectedTargetId, setRejectedTargetId] = useState<string | null>(null);
  const [arrowRejection, setArrowRejection] = useState<ConnectionRejection | null>(null);
  const [arrowInput, setArrowInput] = useState<'touch' | 'pointer'>('touch');
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
  const [arrowPointer, setArrowPointer] = useState<{ x: number; y: number } | null>(null);
  const [arrowMessage, setArrowMessage] = useState(arrowModeMessage);
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
  const rejectionOf = useCallback(
    (sourceId: string | null, targetId: string | null) => {
      const from = sourceId ? nodesById.get(sourceId) : undefined;
      const to = targetId ? nodesById.get(targetId) : undefined;
      if (!from || !to) return null;
      const reason = dependencyRejection(
        dependencies,
        { id: from.id, isVisible: !from.data.isHidden },
        { id: to.id, isVisible: !to.data.isHidden },
      );
      return reason ? { reason, source: from, target: to } : null;
    },
    [dependencies, nodesById],
  );
  const reportableRejection = useCallback(
    (sourceId: string | null, targetId: string | null): ConnectionRejection | null => {
      const rejection = rejectionOf(sourceId, targetId);
      if (!rejection || rejection.reason === 'SELF_DEPENDENCY') return null;
      return { reason: rejection.reason, source: rejection.source, target: rejection.target };
    },
    [rejectionOf],
  );
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) =>
      enabled &&
      Boolean(connection.source && nodesById.has(connection.source)) &&
      Boolean(connection.target && nodesById.has(connection.target)) &&
      !rejectionOf(connection.source, connection.target),
    [enabled, nodesById, rejectionOf],
  );
  const highlightCandidate = useCallback(
    (sourceId: string, candidate: string | null) => {
      setTargetId(isValidConnection({ source: sourceId, target: candidate }) ? candidate : null);
      setRejectedTargetId(reportableRejection(sourceId, candidate) ? candidate : null);
    },
    [isValidConnection, reportableRejection],
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
    setRejectedTargetId(null);
    setArrowRejection(null);
    setArrowMessage(arrowModeMessage);
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
  const startArrowMode = useCallback(
    (nodeId: string) => {
      const node = nodesById.get(nodeId);
      if (!enabled || !node || node.data.isHidden) return;
      cancelPendingTouch();
      mobileSource.current = nodeId;
      setArrowInput('pointer');
      setArrowSourceId(nodeId);
      setArrowPointer(null);
      setTargetId(null);
      setRejectedTargetId(null);
      setArrowRejection(null);
      setArrowMessage(arrowModeMessage);
    },
    [cancelPendingTouch, enabled, nodesById],
  );
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
        setArrowRejection(reportableRejection(from, target));
        setArrowMessage('Elige otro nodo como destino');
        setTargetId(null);
        setRejectedTargetId(null);
        setArrowPointer(null);
        return;
      }
      cancelArrowMode();
      onConnect({ source: from, target, sourceHandle: null, targetHandle: null });
    },
    [cancelArrowMode, isValidConnection, onConnect, reportableRejection],
  );
  const onConnectStart: OnConnectStart = useCallback(
    (_event, parameters) => {
      if (!enabled || !parameters.nodeId) return;
      cancelArrowMode();
      source.current = { nodeId: parameters.nodeId, handleId: parameters.handleId };
      emitted.current = false;
      setTargetId(null);
      setRejectedTargetId(null);
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
        if (!('changedTouches' in event)) event.preventDefault();
        event.stopPropagation();
        const point = touch ?? ('clientX' in event ? event : null);
        if (point) setArrowPointer({ x: point.clientX, y: point.clientY });
        highlightCandidate(mobileSource.current, nodeUnderPointer(event));
        return;
      }
      if (!source.current) return;
      highlightCandidate(source.current.nodeId, nodeUnderPointer(event));
    },
    [cancelPendingTouch, highlightCandidate],
  );
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = source.current;
      if (!start) return;
      if (!emitted.current) {
        const target = nodeUnderPointer(event);
        const rejection = reportableRejection(start.nodeId, target);
        if (rejection) onReject(rejection);
        else if (target)
          completeConnection({
            source: start.nodeId,
            sourceHandle: start.handleId,
            target,
            targetHandle: null,
          });
      }
      source.current = null;
      setTargetId(null);
      setRejectedTargetId(null);
      suppressDropClick();
    },
    [completeConnection, onReject, reportableRejection, suppressDropClick],
  );

  const onTouchStartCapture = useCallback(
    (event: ReactTouchEvent) => {
      if (isArrowModeControl(event.target)) return;
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
        setArrowInput('touch');
        setArrowSourceId(nodeId);
        setArrowPointer(null);
        setTargetId(null);
        setRejectedTargetId(null);
        setArrowRejection(null);
        setArrowMessage(arrowModeMessage);
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
      suppressDropClick(500);
      const candidate = nodeUnderPointer(event);
      setArrowPointer(null);
      if (gesture?.armed && (candidate === mobileSource.current || isOverArrowModeControl(event)))
        return;
      chooseMobileTarget(candidate);
    },
    [cancelPendingTouch, chooseMobileTarget, suppressDropClick],
  );

  return {
    targetId,
    rejectedTargetId,
    arrowSourceId,
    arrowPointer,
    arrowMessage,
    arrowRejection,
    arrowInput,
    startArrowMode,
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
