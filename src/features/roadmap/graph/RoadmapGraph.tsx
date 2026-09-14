'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ControlButton,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
} from '@xyflow/react';
import { LayoutTemplate, Maximize } from 'lucide-react';
import {
  findOpenRoadmapPosition,
  roadmapGridSize,
  roadmapNodeSizeForTitle,
  snapToRoadmapGrid,
} from '@/features/roadmap/graph/geometry';
import type { NodeActionIntent } from '@/features/roadmap/graph/node-action';
import {
  roadmapAutoLayoutConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { Button } from '@/shared/ui/button';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeTypes } from '@/features/roadmap/graph/roadmap-node-types';
import { mapRoadmapGraph } from '@/features/roadmap/graph/map-roadmap-graph';
import type {
  RoadmapGraphEditingIntent,
  RoadmapGraphEditing,
  RoadmapGraphProjection,
  RoadmapNodePlacement,
  RoadmapNodePosition,
  RoadmapViewport,
  RoadmapViewportRestoration,
} from '@/features/roadmap/graph/roadmap-graph-projection';
import { roadmapEdgeTypes, type RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import {
  layoutRoadmapGraph,
  type RoadmapLayoutDirection,
} from '@/features/roadmap/graph/dagre-layout';

export type {
  RoadmapGraphEditingIntent,
  RoadmapGraphEditing,
  RoadmapGraphProjection,
  RoadmapNodePlacement,
  RoadmapNodePosition,
  RoadmapNodePositionCause,
  RoadmapViewport,
  RoadmapViewportRestoration,
  StudentRoadmapGraphProjection,
  TeachingRoadmapGraphProjection,
} from '@/features/roadmap/graph/roadmap-graph-projection';

const selectedEdgeColor = 'var(--primary)';
const roadmapFitViewOptions = { padding: 0.28 };
const roadmapDependencyHandles = ['top', 'right', 'bottom', 'left'] as const;

function isRoadmapDependencyHandle(
  value: string,
): value is (typeof roadmapDependencyHandles)[number] {
  return roadmapDependencyHandles.includes(value as (typeof roadmapDependencyHandles)[number]);
}

function normalizeDependencyHandle(
  value: string | null | undefined,
  fallback: (typeof roadmapDependencyHandles)[number],
) {
  return value && isRoadmapDependencyHandle(value) ? value : fallback;
}

function freezeNodePositions(
  positions: readonly RoadmapNodePlacement[],
): readonly RoadmapNodePlacement[] {
  return Object.freeze(
    positions.map(({ nodeId, position }) =>
      Object.freeze({ nodeId, position: Object.freeze({ ...position }) }),
    ),
  );
}

function immutableNodePositions(
  nodes: readonly RoadmapFlowNode[],
): readonly RoadmapNodePlacement[] {
  return freezeNodePositions(
    nodes.map((node) => ({
      nodeId: node.id,
      position: { ...node.position },
    })),
  );
}

function snappedNodePositions(
  positions: readonly RoadmapNodePlacement[],
): readonly RoadmapNodePlacement[] {
  return freezeNodePositions(
    positions.map(({ nodeId, position }) => ({
      nodeId,
      position: snapToRoadmapGrid(position),
    })),
  );
}

function changedNodePositions(
  nodes: readonly RoadmapFlowNode[],
  proposedPositions: readonly RoadmapNodePlacement[],
): readonly RoadmapNodePlacement[] {
  const positionsByNodeId = new Map(nodes.map((node) => [node.id, node.position]));
  return proposedPositions.filter(({ nodeId, position }) => {
    const currentPosition = positionsByNodeId.get(nodeId);
    return (
      currentPosition !== undefined &&
      (currentPosition.x !== position.x || currentPosition.y !== position.y)
    );
  });
}

type AutoLayoutProposal = {
  readonly roadmap: RoadmapDto;
  readonly direction: RoadmapLayoutDirection;
  readonly positions: readonly RoadmapNodePlacement[];
};

function RoadmapGraphToolbar({
  containerRef,
  layoutDirection,
  showAutoLayout,
  canAutoLayout,
  onAutoLayout,
  topRightActions,
  nodes,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  layoutDirection: RoadmapLayoutDirection;
  showAutoLayout: boolean;
  canAutoLayout: boolean;
  onAutoLayout: () => void;
  topRightActions?: (findOpenPosition: (title: string) => RoadmapNodePosition | null) => ReactNode;
  nodes: readonly RoadmapFlowNode[];
}) {
  const { screenToFlowPosition } = useReactFlow();
  const getViewport = useCallback(() => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0, width: 0, height: 0 };
    const topLeft = screenToFlowPosition({ x: bounds.left, y: bounds.top });
    const bottomRight = screenToFlowPosition({
      x: bounds.right,
      y: bounds.bottom,
    });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }, [containerRef, screenToFlowPosition]);
  const findOpenPosition = useCallback(
    (title: string) => {
      const size = roadmapNodeSizeForTitle(title);
      const viewport = getViewport();
      return findOpenRoadmapPosition(
        nodes.map((node) => ({ ...node.position, ...roadmapNodeSizeForTitle(node.data.title) })),
        {
          x: viewport.x + viewport.width / 2 - size.width / 2,
          y: viewport.y + viewport.height / 2 - size.height / 2,
        },
        size,
        viewport,
      );
    },
    [getViewport, nodes],
  );

  return (
    <Panel position="top-right" className="mt-5 mr-5">
      <div className="flex flex-col items-stretch gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm sm:flex-row sm:items-center">
        {showAutoLayout ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start sm:justify-center"
            disabled={!canAutoLayout}
            onClick={onAutoLayout}
          >
            <LayoutTemplate data-icon="inline-start" />
            Ordenar {layoutDirection === 'TB' ? 'horizontalmente' : 'verticalmente'}
          </Button>
        ) : null}
        {topRightActions ? (
          <div className="flex justify-end gap-1.5">{topRightActions(findOpenPosition)}</div>
        ) : null}
      </div>
    </Panel>
  );
}

function RoadmapViewportControls() {
  const { fitView } = useReactFlow();
  return (
    <Controls position="bottom-left" showZoom={false} showFitView={false} showInteractive={false}>
      <ControlButton
        aria-label="Centrar mapa"
        title="Centrar mapa"
        onClick={() => void fitView(roadmapFitViewOptions)}
      >
        <Maximize aria-hidden="true" />
      </ControlButton>
    </Controls>
  );
}

function RoadmapViewportRestorer({
  restoration,
}: {
  restoration?: RoadmapViewportRestoration | null;
}) {
  const { setViewport } = useReactFlow();
  const appliedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!restoration || appliedTokenRef.current === restoration.token) return;
    appliedTokenRef.current = restoration.token;
    void setViewport(restoration.viewport);
  }, [restoration, setViewport]);
  return null;
}

function ActionMenuViewportAdjustment({
  nodeId,
  containerRef,
}: {
  nodeId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    if (!nodeId) return;
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      const node = container?.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
      if (!container || !node) return;
      const canvas = container.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      const horizontalOverflow = Math.max(0, bounds.right + 210 - canvas.right);
      const verticalOverflow = Math.max(0, bounds.bottom + 196 - canvas.bottom);
      if (!horizontalOverflow && !verticalOverflow) return;
      const viewport = getViewport();
      void setViewport(
        {
          x: viewport.x - horizontalOverflow,
          y: viewport.y - verticalOverflow,
          zoom: viewport.zoom,
        },
        { duration: 200 },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [containerRef, getViewport, nodeId, setViewport]);

  return null;
}

function updateEdgeAppearance(edge: RoadmapFlowEdge, isHovered = false): RoadmapFlowEdge {
  const defaultStroke = edge.data?.defaultStroke ?? 'var(--steel)';
  const stroke = edge.selected || isHovered ? selectedEdgeColor : defaultStroke;
  return {
    ...edge,
    style: { ...edge.style, stroke, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
  };
}

export type RoadmapGraphProps = {
  projection: RoadmapGraphProjection;
  onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
  onClearSelectedNode?: () => void;
  selectedNodeId?: string | null;
  topRightActions?: (findOpenPosition: (title: string) => RoadmapNodePosition | null) => ReactNode;
  overlaySlots?: RoadmapGraphOverlaySlots;
  onViewportChange?: (viewport: RoadmapViewport) => void;
  viewportRestoration?: RoadmapViewportRestoration | null;
};

export type RoadmapGraphOverlaySlots = {
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  bottomRight?: ReactNode;
};

export type RoadmapGraphHandle = {
  closeActionMenus: () => void;
};

function RoadmapGraphOverlays({ slots }: { slots?: RoadmapGraphOverlaySlots }) {
  return (
    <>
      {slots?.topLeft ? (
        <Panel
          position="top-left"
          className="pointer-events-none z-4! m-4! max-w-[calc(100%-2rem)] sm:m-6! sm:max-w-md"
        >
          {slots.topLeft}
        </Panel>
      ) : null}
      {slots?.topCenter ? (
        <Panel position="top-center" className="mt-3! w-[calc(100%-2rem)] max-w-xl sm:w-auto">
          {slots.topCenter}
        </Panel>
      ) : null}
      {slots?.bottomRight ? (
        <Panel
          position="bottom-right"
          className="pointer-events-none mr-5! mb-[18px]! grid w-[min(23rem,calc(100%-2.5rem))] items-end justify-items-end [&>*]:col-start-1 [&>*]:row-start-1"
        >
          {slots.bottomRight}
        </Panel>
      ) : null}
    </>
  );
}

export const RoadmapGraph = forwardRef<RoadmapGraphHandle, RoadmapGraphProps>(function RoadmapGraph(
  {
    projection,
    onSelectNode,
    onClearSelectedNode,
    selectedNodeId,
    topRightActions,
    overlaySlots,
    onViewportChange,
    viewportRestoration,
  }: RoadmapGraphProps,
  ref,
) {
  const editing: RoadmapGraphEditing | undefined =
    projection.kind === 'teaching' ? projection.editing : undefined;
  const canEdit = editing !== undefined;
  const projectionKind = projection.kind;
  const projectionRoadmap = projection.roadmap;
  const stableProjection = useMemo<RoadmapGraphProjection>(() => {
    if (projectionKind === 'student') {
      return { kind: 'student', roadmap: projectionRoadmap as StudentRoadmapDto };
    }
    return { kind: 'teaching', roadmap: projectionRoadmap as RoadmapDto, editing };
  }, [editing, projectionKind, projectionRoadmap]);
  const [layoutDirection, setLayoutDirection] = useState<RoadmapLayoutDirection>('TB');
  const [autoLayoutProposal, setAutoLayoutProposal] = useState<AutoLayoutProposal | null>(null);
  const [openActionMenuNodeId, setOpenActionMenuNodeId] = useState<string | null>(null);
  const [closingActionMenuNodeId, setClosingActionMenuNodeId] = useState<string | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEditingIntent = editing?.onEditingIntent;
  // El lienzo guarda las posiciones que el arrastre todavía no ha recargado, de
  // modo que solo un roadmap nuevo puede reemplazarlas. Las devoluciones viven
  // en una referencia para que un render del contenedor no rehaga el grafo.
  const handlers = useRef<{ onEditingIntent?: (intent: RoadmapGraphEditingIntent) => void }>({
    onEditingIntent,
  });
  useEffect(() => {
    handlers.current = { onEditingIntent };
  }, [onEditingIntent]);
  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);
  const keyboardMovePendingRef = useRef(false);
  const emitEditingIntent = useCallback((intent: RoadmapGraphEditingIntent) => {
    handlers.current.onEditingIntent?.(intent);
  }, []);
  const deleteDependencies = useCallback(
    (dependencyIds: readonly string[]) => {
      if (dependencyIds.length === 0) return;
      emitEditingIntent({
        kind: 'delete-dependencies',
        dependencyIds: Object.freeze([...dependencyIds]),
      });
    },
    [emitEditingIntent],
  );
  const deleteDependency = useCallback(
    (dependencyId: string) => deleteDependencies([dependencyId]),
    [deleteDependencies],
  );
  const beginClosingActionMenu = useCallback((nodeId: string) => {
    if (actionMenuCloseTimerRef.current) clearTimeout(actionMenuCloseTimerRef.current);
    setClosingActionMenuNodeId(nodeId);
    actionMenuCloseTimerRef.current = setTimeout(() => setClosingActionMenuNodeId(null), 400);
  }, []);
  const closeActionMenu = useCallback(
    (restoreFocus = true) => {
      if (openActionMenuNodeId) beginClosingActionMenu(openActionMenuNodeId);
      setOpenActionMenuNodeId(null);
      if (restoreFocus) requestAnimationFrame(() => actionMenuTriggerRef.current?.focus());
    },
    [beginClosingActionMenu, openActionMenuNodeId],
  );
  const closeActionMenus = useCallback(() => {
    setOpenActionMenuNodeId(null);
    setClosingActionMenuNodeId(null);
  }, []);
  useImperativeHandle(ref, () => ({ closeActionMenus }), [closeActionMenus]);
  const toggleActionMenu = useCallback(
    (nodeId: string, trigger: HTMLButtonElement) => {
      actionMenuTriggerRef.current = trigger;
      if (openActionMenuNodeId === nodeId) {
        closeActionMenu();
        return;
      }
      if (openActionMenuNodeId) beginClosingActionMenu(openActionMenuNodeId);
      setOpenActionMenuNodeId(nodeId);
    },
    [beginClosingActionMenu, closeActionMenu, openActionMenuNodeId],
  );
  const requestNodeAction = useCallback(
    (intent: NodeActionIntent) => {
      closeActionMenu(false);
      emitEditingIntent(intent);
    },
    [closeActionMenu, emitEditingIntent],
  );
  const actionMenu = useMemo(
    () => ({
      openNodeId: canEdit ? openActionMenuNodeId : null,
      closingNodeId: canEdit ? closingActionMenuNodeId : null,
      onToggle: toggleActionMenu,
      onAction: requestNodeAction,
    }),
    [canEdit, closingActionMenuNodeId, openActionMenuNodeId, requestNodeAction, toggleActionMenu],
  );
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(stableProjection, deleteDependency, selectedNodeId, actionMenu),
  );

  useEffect(() => {
    setFlow(
      mapRoadmapGraph(stableProjection, deleteDependency, selectedNodeIdRef.current, actionMenu),
    );
  }, [actionMenu, deleteDependency, stableProjection]);

  const applyNodePositions = useCallback(
    (cause: 'pointer' | 'keyboard' | 'automatic-layout', positions: readonly RoadmapNodePlacement[]) => {
      const immutablePositions = freezeNodePositions(positions);
      if (immutablePositions.length === 0) return;
      const positionsByNodeId = new Map(
        immutablePositions.map(({ nodeId, position }) => [nodeId, position]),
      );
      setFlow((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          const position = positionsByNodeId.get(node.id);
          return position ? { ...node, position } : node;
        }),
      }));
      emitEditingIntent({ kind: 'node-positions', cause, positions: immutablePositions });
    },
    [emitEditingIntent],
  );

  const previousSelectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    if (previousSelectedNodeIdRef.current !== selectedNodeId && openActionMenuNodeId)
      closeActionMenu(false);
    previousSelectedNodeIdRef.current = selectedNodeId;
  }, [closeActionMenu, openActionMenuNodeId, selectedNodeId]);

  useEffect(() => {
    setFlow((current) => ({
      ...current,
      nodes: current.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    }));
  }, [selectedNodeId]);

  const connectNodes = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      emitEditingIntent({
        kind: 'create-dependency',
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        sourceHandle: normalizeDependencyHandle(connection.sourceHandle, 'right'),
        targetHandle: normalizeDependencyHandle(connection.targetHandle, 'left'),
      });
    },
    [emitEditingIntent],
  );

  const proposeAutoLayout = useCallback(() => {
    const direction = layoutDirection === 'TB' ? 'LR' : 'TB';
    setAutoLayoutProposal({
      roadmap: projectionRoadmap as RoadmapDto,
      direction,
      positions: immutableNodePositions(layoutRoadmapGraph(flow.nodes, flow.edges, direction)),
    });
  }, [flow.edges, flow.nodes, layoutDirection, projectionRoadmap]);

  useEffect(() => {
    if (autoLayoutProposal?.roadmap !== projectionRoadmap) setAutoLayoutProposal(null);
  }, [autoLayoutProposal, projectionRoadmap]);

  const handleAutoLayoutAction = useCallback(
    (actionId: string) => {
      if (actionId !== roadmapConfirmationActionIds.autoLayout) return;
      if (!autoLayoutProposal || autoLayoutProposal.roadmap !== projectionRoadmap) return;
      setAutoLayoutProposal(null);
      setLayoutDirection(autoLayoutProposal.direction);
      applyNodePositions(
        'automatic-layout',
        changedNodePositions(flow.nodes, autoLayoutProposal.positions),
      );
    },
    [applyNodePositions, autoLayoutProposal, flow.nodes, projectionRoadmap],
  );

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative h-full"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && (openActionMenuNodeId || closingActionMenuNodeId)) {
          event.preventDefault();
          event.stopPropagation();
          closeActionMenu();
          return;
        }
        const node = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
        if (!node) return;
        if (event.key === 'Escape' && node.dataset.id === selectedNodeIdRef.current) {
          onClearSelectedNode?.();
          return;
        }
        if (
          canEdit &&
          !openActionMenuNodeId &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
        )
          keyboardMovePendingRef.current = true;
      }}
    >
      <ReactFlow<RoadmapFlowNode, RoadmapFlowEdge>
        className="h-full"
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={roadmapNodeTypes}
        edgeTypes={roadmapEdgeTypes}
        nodesDraggable={canEdit && !openActionMenuNodeId && !closingActionMenuNodeId}
        nodesConnectable={canEdit && !openActionMenuNodeId && !closingActionMenuNodeId}
        snapToGrid
        snapGrid={[roadmapGridSize, roadmapGridSize]}
        connectionMode={ConnectionMode.Loose}
        nodesFocusable
        nodeDragThreshold={5}
        nodeClickDistance={6}
        elementsSelectable={!openActionMenuNodeId && !closingActionMenuNodeId}
        panOnDrag={!openActionMenuNodeId && !closingActionMenuNodeId}
        zoomOnScroll={!openActionMenuNodeId && !closingActionMenuNodeId}
        zoomOnPinch={!openActionMenuNodeId && !closingActionMenuNodeId}
        zoomOnDoubleClick={!openActionMenuNodeId && !closingActionMenuNodeId}
        deleteKeyCode={
          openActionMenuNodeId || closingActionMenuNodeId ? null : ['Backspace', 'Delete']
        }
        onNodesChange={(changes: NodeChange<RoadmapFlowNode>[]) => {
          const movedWithKeyboard = keyboardMovePendingRef.current;
          keyboardMovePendingRef.current = false;
          const positions = changes.flatMap((change) =>
            change.type === 'position' && change.position
              ? [{ nodeId: change.id, position: change.position }]
              : [],
          );
          const normalizedChanges = changes.map((change) =>
            change.type === 'position' && change.position
              ? { ...change, position: snapToRoadmapGrid(change.position) }
              : change,
          );
          setFlow((current) => ({
            ...current,
            nodes: applyNodeChanges(
              normalizedChanges.filter(
                (change) => change.type !== 'remove' && (!movedWithKeyboard || change.type !== 'position'),
              ),
              current.nodes,
            ),
          }));
          if (movedWithKeyboard) applyNodePositions('keyboard', snappedNodePositions(positions));
        }}
        onEdgesChange={(changes: EdgeChange<RoadmapFlowEdge>[]) =>
          setFlow((current) => ({
            ...current,
            edges: applyEdgeChanges(
              changes.filter((change) => change.type !== 'remove'),
              current.edges,
            ).map((edge) => (canEdit ? updateEdgeAppearance(edge) : edge)),
          }))
        }
        onNodeClick={(event, node) => {
          if (node.data.blockReason) return;
          onSelectNode(node.id, event.currentTarget as HTMLElement);
        }}
        onPaneClick={() => {
          if (openActionMenuNodeId || closingActionMenuNodeId) closeActionMenu(false);
        }}
        onEdgeMouseEnter={
          canEdit
            ? (_event, edge) =>
                setFlow((current) => ({
                  ...current,
                  edges: current.edges.map((currentEdge) =>
                    currentEdge.id === edge.id
                      ? updateEdgeAppearance(currentEdge, true)
                      : currentEdge,
                  ),
                }))
            : undefined
        }
        onEdgeMouseLeave={
          canEdit
            ? (_event, edge) =>
                setFlow((current) => ({
                  ...current,
                  edges: current.edges.map((currentEdge) =>
                    currentEdge.id === edge.id ? updateEdgeAppearance(currentEdge) : currentEdge,
                  ),
                }))
            : undefined
        }
        onNodeDragStop={
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId
            ? (_event, node) => {
                applyNodePositions('pointer', snappedNodePositions(immutableNodePositions([node])));
              }
            : undefined
        }
        onConnect={
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId ? connectNodes : undefined
        }
        onEdgesDelete={
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId
            ? (edges) => deleteDependencies(edges.map((edge) => edge.id))
            : undefined
        }
        onMoveEnd={(event, viewport) => {
          if (!event) return;
          onViewportChange?.({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
        }}
        fitView
        fitViewOptions={roadmapFitViewOptions}
        proOptions={{ hideAttribution: true }}
      >
        <RoadmapGraphOverlays slots={overlaySlots} />
        <RoadmapViewportControls />
        <RoadmapViewportRestorer restoration={viewportRestoration} />
        <ActionMenuViewportAdjustment
          nodeId={canEdit ? openActionMenuNodeId : null}
          containerRef={containerRef}
        />
        {canEdit || topRightActions ? (
          <RoadmapGraphToolbar
            containerRef={containerRef}
            layoutDirection={layoutDirection}
            showAutoLayout={canEdit}
            canAutoLayout={canEdit && flow.nodes.length >= 2}
            onAutoLayout={proposeAutoLayout}
            topRightActions={topRightActions}
            nodes={flow.nodes}
          />
        ) : null}
        <Background
          aria-label="Cuadrícula del lienzo"
          variant={BackgroundVariant.Lines}
          color="var(--fog)"
          gap={roadmapGridSize}
          size={1}
        />
      </ReactFlow>
      <ConfirmationDialog
        confirmation={autoLayoutProposal ? roadmapAutoLayoutConfirmation : null}
        onCancel={() => setAutoLayoutProposal(null)}
        onAction={handleAutoLayoutAction}
      />
    </div>
  );
});
