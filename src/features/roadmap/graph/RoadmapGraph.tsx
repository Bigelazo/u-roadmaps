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
  type OnNodeDrag,
  type Viewport,
  useReactFlow,
} from '@xyflow/react';
import { LayoutTemplate, Maximize } from 'lucide-react';
import { roadmapGridSize, type NodeRect } from '@/features/roadmap/graph/geometry';
import type { NodeAccessActionOperation } from '@/features/roadmap/graph/node-action';
import {
  roadmapAutoLayoutConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { Button } from '@/shared/ui/button';
import { ConfirmationDialog, type ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';
import type { AnyRoadmapDto } from '@/features/roadmap/types';
import { type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeTypes } from '@/features/roadmap/graph/roadmap-node-types';
import { mapRoadmapGraph } from '@/features/roadmap/graph/map-roadmap-graph';
import { roadmapEdgeTypes, type RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import {
  layoutRoadmapGraph,
  type RoadmapLayoutDirection,
} from '@/features/roadmap/graph/dagre-layout';

const selectedEdgeColor = 'var(--primary)';
const roadmapFitViewOptions = { padding: 0.28 };

function RoadmapGraphToolbar({
  containerRef,
  layoutDirection,
  showAutoLayout,
  canAutoLayout,
  onAutoLayout,
  topRightActions,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  layoutDirection: RoadmapLayoutDirection;
  showAutoLayout: boolean;
  canAutoLayout: boolean;
  onAutoLayout: () => void;
  topRightActions?: (getViewport: () => NodeRect) => ReactNode;
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
          <div className="flex justify-end gap-1.5">{topRightActions(getViewport)}</div>
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

function RoadmapViewportRestorer({ viewport }: { viewport?: Viewport | null }) {
  const { setViewport } = useReactFlow();
  useEffect(() => {
    if (viewport) void setViewport(viewport);
  }, [setViewport, viewport]);
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

type Props = {
  roadmap: AnyRoadmapDto;
  canEdit: boolean;
  isTeacherView?: boolean;
  onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
  onMoveNode: OnNodeDrag<RoadmapFlowNode>;
  onConnectNodes: (connection: Connection) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
  onAutoLayout: (nodes: RoadmapFlowNode[]) => void;
  onClearSelectedNode?: () => void;
  onKeyboardNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
  selectedNodeId?: string | null;
  topRightActions?: (getViewport: () => NodeRect) => ReactNode;
  onViewportChange?: (viewport: Viewport) => void;
  restoreViewport?: Viewport | null;
  onRequestAccessAction?: (nodeId: string, operation: NodeAccessActionOperation) => void;
  onRequestVisibilityAction?: (nodeId: string, isVisible: boolean) => void;
  onRequestAddResource?: (nodeId: string) => void;
  onRequestDelete?: (nodeId: string) => void;
};

export type RoadmapGraphHandle = {
  closeActionMenus: () => void;
};

export const RoadmapGraph = forwardRef<RoadmapGraphHandle, Props>(function RoadmapGraph(
  {
    roadmap,
    canEdit,
    isTeacherView = canEdit,
    onSelectNode,
    onMoveNode,
    onConnectNodes,
    onDeleteDependencies,
    onAutoLayout,
    onClearSelectedNode,
    onKeyboardNodeMove,
    selectedNodeId,
    topRightActions,
    onViewportChange,
    restoreViewport,
    onRequestAccessAction,
    onRequestVisibilityAction,
    onRequestAddResource,
    onRequestDelete,
  }: Props,
  ref,
) {
  const [layoutDirection, setLayoutDirection] = useState<RoadmapLayoutDirection>('TB');
  const [autoLayoutConfirmation, setAutoLayoutConfirmation] =
    useState<ConfirmationPresentation | null>(null);
  const [openActionMenuNodeId, setOpenActionMenuNodeId] = useState<string | null>(null);
  const [closingActionMenuNodeId, setClosingActionMenuNodeId] = useState<string | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El lienzo guarda las posiciones que el arrastre todavía no ha recargado, de
  // modo que solo un roadmap nuevo puede reemplazarlas. Las devoluciones viven
  // en una referencia para que un render del contenedor no rehaga el grafo.
  const handlers = useRef({
    onDeleteDependencies,
    onRequestAccessAction,
    onRequestVisibilityAction,
    onRequestAddResource,
    onRequestDelete,
  });
  useEffect(() => {
    handlers.current = {
      onDeleteDependencies,
      onRequestAccessAction,
      onRequestVisibilityAction,
      onRequestAddResource,
      onRequestDelete,
    };
  }, [
    onDeleteDependencies,
    onRequestAccessAction,
    onRequestVisibilityAction,
    onRequestAddResource,
    onRequestDelete,
  ]);
  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);
  const keyboardMovePendingRef = useRef(false);
  const deleteDependency = useCallback(
    (dependencyId: string) => handlers.current.onDeleteDependencies([dependencyId]),
    [],
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
  const requestAccessAction = useCallback(
    (nodeId: string, operation: NodeAccessActionOperation) => {
      closeActionMenu(false);
      handlers.current.onRequestAccessAction?.(nodeId, operation);
    },
    [closeActionMenu],
  );
  const requestVisibilityAction = useCallback(
    (nodeId: string, isVisible: boolean) => {
      closeActionMenu(false);
      handlers.current.onRequestVisibilityAction?.(nodeId, isVisible);
    },
    [closeActionMenu],
  );
  const requestAddResource = useCallback(
    (nodeId: string) => {
      closeActionMenu(false);
      handlers.current.onRequestAddResource?.(nodeId);
    },
    [closeActionMenu],
  );
  const requestDelete = useCallback(
    (nodeId: string) => {
      closeActionMenu(false);
      handlers.current.onRequestDelete?.(nodeId);
    },
    [closeActionMenu],
  );
  const actionMenu = useMemo(
    () => ({
      openNodeId: canEdit ? openActionMenuNodeId : null,
      closingNodeId: canEdit ? closingActionMenuNodeId : null,
      onToggle: toggleActionMenu,
      onRequestAccessAction: requestAccessAction,
      onRequestVisibilityAction: requestVisibilityAction,
      onRequestAddResource: requestAddResource,
      onRequestDelete: requestDelete,
    }),
    [
      canEdit,
      closingActionMenuNodeId,
      openActionMenuNodeId,
      requestAccessAction,
      requestVisibilityAction,
      requestAddResource,
      requestDelete,
      toggleActionMenu,
    ],
  );
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(roadmap, isTeacherView, deleteDependency, selectedNodeId, actionMenu),
  );

  useEffect(() => {
    setFlow(
      mapRoadmapGraph(
        roadmap,
        isTeacherView,
        deleteDependency,
        selectedNodeIdRef.current,
        actionMenu,
      ),
    );
  }, [actionMenu, deleteDependency, isTeacherView, roadmap]);

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
    (connection: Connection) => onConnectNodes(connection),
    [onConnectNodes],
  );

  const applyAutoLayout = useCallback(() => {
    const direction = layoutDirection === 'TB' ? 'LR' : 'TB';
    const nodes = layoutRoadmapGraph(flow.nodes, flow.edges, direction);
    setFlow((current) => ({ ...current, nodes }));
    setLayoutDirection(direction);
    onAutoLayout(nodes);
  }, [flow.edges, flow.nodes, layoutDirection, onAutoLayout]);

  const handleAutoLayoutAction = useCallback(
    (actionId: string) => {
      if (actionId !== roadmapConfirmationActionIds.autoLayout) return;
      setAutoLayoutConfirmation(null);
      applyAutoLayout();
    },
    [applyAutoLayout],
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
          setFlow((current) => ({
            ...current,
            nodes: applyNodeChanges(
              changes.filter((change) => change.type !== 'remove'),
              current.nodes,
            ),
          }));
          if (movedWithKeyboard) {
            for (const change of changes) {
              if (change.type === 'position' && change.position)
                onKeyboardNodeMove?.(change.id, change.position);
            }
          }
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
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId ? onMoveNode : undefined
        }
        onConnect={
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId ? connectNodes : undefined
        }
        onEdgesDelete={
          canEdit && !openActionMenuNodeId && !closingActionMenuNodeId
            ? (edges) => onDeleteDependencies(edges.map((edge) => edge.id))
            : undefined
        }
        onMoveEnd={(_event, viewport) => onViewportChange?.(viewport)}
        fitView
        fitViewOptions={roadmapFitViewOptions}
        proOptions={{ hideAttribution: true }}
      >
        <RoadmapViewportControls />
        <RoadmapViewportRestorer viewport={restoreViewport} />
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
            onAutoLayout={() => setAutoLayoutConfirmation(roadmapAutoLayoutConfirmation)}
            topRightActions={topRightActions}
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
        confirmation={autoLayoutConfirmation}
        onCancel={() => setAutoLayoutConfirmation(null)}
        onAction={handleAutoLayoutAction}
      />
    </div>
  );
});
