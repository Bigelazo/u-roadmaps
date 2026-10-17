'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
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
import type { NodeActionCallbacks, NodeActionIntent } from '@/features/roadmap/graph/node-action';
import { Button } from '@/shared/ui/button';
import { NodeActionSheet, useNodeActionSheet } from '@/features/roadmap/graph/NodeActionSheet';
import { type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeTypes } from '@/features/roadmap/graph/roadmap-node-types';
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
import { studentNodeBlockReason, studentNodeStatus } from '@/features/roadmap/student/node-status';
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
  RoadmapViewport,
  RoadmapViewportRestoration,
  StudentRoadmapGraphProjection,
  TeachingRoadmapGraphProjection,
} from '@/features/roadmap/graph/roadmap-graph-projection';

const selectedEdgeColor = 'var(--primary)';
const roadmapFitViewOptions = { padding: 0.28 };
const roadmapDependencyHandles = ['top', 'right', 'bottom', 'left'] as const;
const studentEdgeStroke = 'var(--ink)';
const bottomRightPanelClassName =
  'pointer-events-none mr-4! mb-[18px]! grid w-[min(23rem,calc(100%-2.5rem))] items-end justify-items-end sm:mr-6! [&>*]:col-start-1 [&>*]:row-start-1';

type RoadmapGraphActionMenu = NodeActionCallbacks & {
  useActionSheet: boolean;
  openNodeId: string | null;
  closingNodeId: string | null;
  onToggle: (nodeId: string, trigger: HTMLButtonElement) => void;
};

function mapProjectionToFlow(
  projection: RoadmapGraphProjection,
  onDeleteDependency: (dependencyId: string) => void,
  selectedNodeId: string | null | undefined,
  actionMenu: RoadmapGraphActionMenu,
  notificationsEnabled = false,
) {
  const { roadmap } = projection;
  const isTeacherView = projection.kind === 'teaching';
  const canEdit = isTeacherView && Boolean(projection.editing);
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: RoadmapFlowNode[] = roadmap.nodes.map((node) => {
    const isHidden = 'isVisible' in node && !node.isVisible;
    const blockReason = isTeacherView ? undefined : studentNodeBlockReason(node);
    const resources = 'resources' in node ? node.resources : [];
    const nodeType = nodeTypesById.get(node.nodeTypeId);
    const isActionMenuOpen =
      actionMenu.openNodeId === node.id || actionMenu.closingNodeId === node.id;
    return {
      id: node.id,
      type: 'roadmap',
      data: {
        roadmapId: roadmap.roadmap.id,
        notificationsEnabled,
        title: node.title,
        typeColor: nodeType?.color ?? 'var(--primary)',
        typeName: nodeType?.name ?? 'Sin tipo',
        typeIcon: nodeType?.icon ?? 'Shapes',
        status: isTeacherView ? 'editing' : studentNodeStatus(node),
        isHidden,
        isTeacherBlocked: isTeacherView && 'isTeacherBlocked' in node && node.isTeacherBlocked,
        fileCount: resources.filter((resource) => resource.type === 'FILE').length,
        linkCount: resources.filter((resource) => resource.type !== 'FILE').length,
        blockReason,
        canManageActions: canEdit,
        useActionSheet: actionMenu.useActionSheet,
        isActionMenuOpen,
        isActionMenuClosing: actionMenu.closingNodeId === node.id,
        onToggleActionMenu: actionMenu.onToggle,
        onAction: actionMenu.onAction,
      },
      position: { x: node.positionX, y: node.positionY },
      selected: node.id === selectedNodeId,
      hidden: !isTeacherView && isHidden,
      connectable: canEdit && !isHidden,
      deletable: false,
      selectable: canEdit || !blockReason,
      focusable: true,
      zIndex: isActionMenuOpen ? 20 : 0,
      ariaRole: blockReason ? 'button' : undefined,
      domAttributes: blockReason ? { 'aria-disabled': true } : undefined,
    };
  });
  const edges: RoadmapFlowEdge[] = roadmap.dependencies.map((dependency) => {
    const defaultStroke =
      isTeacherView && !canEdit
        ? '#000'
        : isTeacherView
          ? (() => {
              const sourceNode = nodesById.get(dependency.sourceNodeId);
              return sourceNode && 'isCompleted' in sourceNode && sourceNode.isCompleted;
            })()
            ? 'var(--ink)'
            : 'var(--steel)'
          : studentEdgeStroke;
    return {
      id: dependency.id,
      source: dependency.sourceNodeId,
      target: dependency.targetNodeId,
      sourceHandle: dependency.sourceHandle,
      targetHandle: dependency.targetHandle,
      type: 'dependency',
      deletable: canEdit,
      selectable: canEdit,
      focusable: canEdit,
      interactionWidth: canEdit ? undefined : 0,
      domAttributes: canEdit ? undefined : { pointerEvents: 'none' },
      className: canEdit ? 'roadmap-edge--editable' : 'roadmap-edge--student',
      data: { defaultStroke, onDelete: canEdit ? onDeleteDependency : undefined },
      style: { stroke: defaultStroke, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: defaultStroke, width: 18, height: 18 },
    };
  });
  return { nodes, edges };
}

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

function RoadmapGraphToolbar({
  containerRef,
  layoutDirection,
  showAutoLayout,
  canAutoLayout,
  onAutoLayout,
  onFitView,
  bottomLeftActions,
  bottomRightActions,
  nodes,
}: {
  onFitView?: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  layoutDirection: RoadmapLayoutDirection;
  showAutoLayout: boolean;
  canAutoLayout: boolean;
  onAutoLayout: () => void;
  bottomLeftActions?: (
    findOpenPosition: (title: string) => RoadmapNodePosition | null,
  ) => ReactNode;
  bottomRightActions?: (
    findOpenPosition: (title: string) => RoadmapNodePosition | null,
  ) => ReactNode;
  nodes: readonly RoadmapFlowNode[];
}) {
  const { fitView, screenToFlowPosition } = useReactFlow();
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
    <>
      <Panel position="bottom-left" className="m-4! max-w-[calc(100%-2rem)] sm:m-6!">
        <div className="flex flex-col items-stretch gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Centrar mapa"
                  type="button"
                  variant="outline"
                  size="icon"
                  className="self-start sm:self-auto"
                  onClick={() => void fitView(roadmapFitViewOptions).then(() => onFitView?.())}
                >
                  <Maximize aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Centrar mapa</TooltipContent>
          </Tooltip>
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
          {bottomLeftActions ? (
            <div className="flex flex-wrap gap-1.5">{bottomLeftActions(findOpenPosition)}</div>
          ) : null}
        </div>
      </Panel>
      {bottomRightActions ? (
        <Panel position="bottom-right" className={bottomRightPanelClassName}>
          <div className="pointer-events-auto">{bottomRightActions(findOpenPosition)}</div>
        </Panel>
      ) : null}
    </>
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
  notificationsEnabled?: boolean;
  onSelectNode: (nodeId: string) => void;
  onClearSelectedNode?: () => void;
  selectedNodeId?: string | null;
  focusReturnRequest?: string | null;
  bottomLeftActions?: (
    findOpenPosition: (title: string) => RoadmapNodePosition | null,
  ) => ReactNode;
  bottomRightActions?: (
    findOpenPosition: (title: string) => RoadmapNodePosition | null,
  ) => ReactNode;
  overlaySlots?: RoadmapGraphOverlaySlots;
  onViewportChange?: (viewport: RoadmapViewport) => void;
  viewportRestoration?: RoadmapViewportRestoration | null;
  confirmedAutomaticLayout?: { token: string; direction: RoadmapLayoutDirection } | null;
  /** Called once "Centrar mapa" has fitted the view. */
  onFitView?: () => void;
};

export type RoadmapGraphOverlaySlots = {
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  bottomRight?: ReactNode;
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
      {slots?.topRight ? (
        <Panel position="top-right" className="m-4! sm:m-6!">
          {slots.topRight}
        </Panel>
      ) : null}
      {slots?.bottomRight ? (
        <Panel position="bottom-right" className={bottomRightPanelClassName}>
          {slots.bottomRight}
        </Panel>
      ) : null}
    </>
  );
}

type NodeActionMenuState = {
  editing: RoadmapGraphEditing;
  selectedNodeId: string | null | undefined;
  nodeId: string;
} | null;

/** A menu state applies only while its editing session and Node selection are current. */
function activeMenuNodeId(
  state: NodeActionMenuState,
  editing: RoadmapGraphEditing | undefined,
  selectedNodeId: string | null | undefined,
) {
  return editing && state?.editing === editing && state.selectedNodeId === selectedNodeId
    ? state.nodeId
    : null;
}

function useNodeActionMenu({
  editing,
  useActionSheet,
  selectedNodeId,
  selectedNodeIdRef,
  emitEditingIntent,
}: {
  editing: RoadmapGraphEditing | undefined;
  useActionSheet: boolean;
  selectedNodeId: string | null | undefined;
  selectedNodeIdRef: RefObject<string | null | undefined>;
  emitEditingIntent: (intent: RoadmapGraphEditingIntent) => void;
}) {
  const [openMenu, setOpenMenu] = useState<NodeActionMenuState>(null);
  const [closingMenu, setClosingMenu] = useState<NodeActionMenuState>(null);
  const openNodeId = activeMenuNodeId(openMenu, editing, selectedNodeId);
  const closingNodeId = useActionSheet
    ? null
    : activeMenuNodeId(closingMenu, editing, selectedNodeId);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginClosing = useCallback(
    (nodeId: string) => {
      if (!editing || useActionSheet) return;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setClosingMenu({ editing, selectedNodeId: selectedNodeIdRef.current, nodeId });
      closeTimerRef.current = setTimeout(() => setClosingMenu(null), 400);
    },
    [editing, selectedNodeIdRef, useActionSheet],
  );
  const closeActionMenu = useCallback(
    (restoreFocus = true) => {
      restoreFocusRef.current = restoreFocus;
      if (openNodeId) beginClosing(openNodeId);
      setOpenMenu(null);
      if (restoreFocus && !useActionSheet) requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [beginClosing, openNodeId, useActionSheet],
  );
  const onToggle = useCallback(
    (nodeId: string, trigger: HTMLButtonElement) => {
      if (!editing) return;
      triggerRef.current = trigger;
      if (openNodeId === nodeId) {
        closeActionMenu();
        return;
      }
      if (openNodeId) beginClosing(openNodeId);
      restoreFocusRef.current = true;
      setOpenMenu({ editing, selectedNodeId: selectedNodeIdRef.current, nodeId });
    },
    [beginClosing, closeActionMenu, editing, openNodeId, selectedNodeIdRef],
  );
  const onAction = useCallback(
    (intent: NodeActionIntent) => {
      closeActionMenu(false);
      emitEditingIntent(intent);
    },
    [closeActionMenu, emitEditingIntent],
  );
  const actionMenu = useMemo<RoadmapGraphActionMenu>(
    () => ({ useActionSheet, openNodeId, closingNodeId, onToggle, onAction }),
    [closingNodeId, onAction, onToggle, openNodeId, useActionSheet],
  );
  return {
    actionMenu,
    closeActionMenu,
    actionMenuFinalFocus: () => (restoreFocusRef.current ? triggerRef.current : false),
  };
}

function useRoadmapGraphController({
  projection,
  notificationsEnabled,
  selectedNodeId,
  focusReturnRequest,
  confirmedAutomaticLayout,
}: RoadmapGraphProps) {
  const editing: RoadmapGraphEditing | undefined =
    projection.kind === 'teaching' ? projection.editing : undefined;
  const canEdit = editing !== undefined;
  const useActionSheet = useNodeActionSheet();
  const projectionKind = projection.kind;
  const projectionRoadmap = projection.roadmap;
  const stableProjection = useMemo<RoadmapGraphProjection>(() => {
    if (projectionKind === 'student') {
      return { kind: 'student', roadmap: projectionRoadmap as StudentRoadmapDto };
    }
    return { kind: 'teaching', roadmap: projectionRoadmap as RoadmapDto, editing };
  }, [editing, projectionKind, projectionRoadmap]);
  const layoutDirection = confirmedAutomaticLayout?.direction ?? 'TB';
  const onEditingIntent = editing?.onEditingIntent;
  // The canvas keeps positions that a drag has not reloaded yet, so only a new
  // roadmap can replace them. The callbacks live in a ref so that a container
  // render does not rebuild the graph.
  const handlers = useRef<{ onEditingIntent?: (intent: RoadmapGraphEditingIntent) => void }>({
    onEditingIntent,
  });
  useEffect(() => {
    handlers.current = { onEditingIntent };
  }, [onEditingIntent]);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const lastSelectedNodeIdRef = useRef<string | null>(selectedNodeId ?? null);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    if (selectedNodeId) lastSelectedNodeIdRef.current = selectedNodeId;
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
  const { actionMenu, closeActionMenu, actionMenuFinalFocus } = useNodeActionMenu({
    editing,
    useActionSheet,
    selectedNodeId,
    selectedNodeIdRef,
    emitEditingIntent,
  });
  const [flow, setFlow] = useState(() =>
    mapProjectionToFlow(
      stableProjection,
      deleteDependency,
      selectedNodeId,
      actionMenu,
      notificationsEnabled,
    ),
  );

  useEffect(() => {
    setFlow(
      mapProjectionToFlow(
        stableProjection,
        deleteDependency,
        selectedNodeIdRef.current,
        actionMenu,
        notificationsEnabled,
      ),
    );
  }, [actionMenu, deleteDependency, notificationsEnabled, stableProjection]);

  const applyNodePositions = useCallback(
    (positions: readonly RoadmapNodePlacement[]) => {
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
      emitEditingIntent({ kind: 'move-nodes', positions: immutablePositions });
    },
    [emitEditingIntent],
  );

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
    const positions = immutableNodePositions(layoutRoadmapGraph(flow.nodes, flow.edges, direction));
    emitEditingIntent({
      kind: 'apply-automatic-layout',
      positions: freezeNodePositions(changedNodePositions(flow.nodes, positions)),
      direction,
    });
  }, [emitEditingIntent, flow.edges, flow.nodes, layoutDirection]);

  const containerRef = useRef<HTMLDivElement>(null);
  const appliedFocusReturnRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusReturnRequest || appliedFocusReturnRequestRef.current === focusReturnRequest) return;
    appliedFocusReturnRequestRef.current = focusReturnRequest;
    const selectedNodeId = lastSelectedNodeIdRef.current;
    if (!selectedNodeId) return;
    if (!projectionRoadmap.nodes.some((node) => node.id === selectedNodeId)) return;
    const node = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>('.react-flow__node') ?? [],
    ).find((candidate) => candidate.dataset.id === selectedNodeId);
    node?.focus();
  }, [focusReturnRequest, projectionRoadmap]);

  return {
    canEdit,
    useActionSheet,
    requestNodeAction: actionMenu.onAction,
    actionMenuFinalFocus,
    layoutDirection,
    openActionMenuNodeId: actionMenu.openNodeId,
    closingActionMenuNodeId: actionMenu.closingNodeId,
    selectedNodeIdRef,
    keyboardMovePendingRef,
    deleteDependencies,
    closeActionMenu,
    flow,
    setFlow,
    applyNodePositions,
    connectNodes,
    proposeAutoLayout,
    containerRef,
  };
}

export function RoadmapGraph(props: RoadmapGraphProps) {
  const { onClearSelectedNode, onSelectNode, onViewportChange } = props;
  const model = useRoadmapGraphController(props);
  const {
    canEdit,
    openActionMenuNodeId,
    closingActionMenuNodeId,
    selectedNodeIdRef,
    keyboardMovePendingRef,
    deleteDependencies,
    closeActionMenu,
    flow,
    setFlow,
    applyNodePositions,
    connectNodes,
    containerRef,
  } = model;

  const isActionMenuActive = Boolean(openActionMenuNodeId || closingActionMenuNodeId);
  const isNavigationEnabled = !isActionMenuActive;
  const canInteract = canEdit && isNavigationEnabled;

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && isActionMenuActive) {
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
  };

  const handleNodesChange = (changes: NodeChange<RoadmapFlowNode>[]) => {
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
          (change) =>
            change.type !== 'remove' && (!movedWithKeyboard || change.type !== 'position'),
        ),
        current.nodes,
      ),
    }));
    if (movedWithKeyboard) applyNodePositions(snappedNodePositions(positions));
  };

  const setEdgeHover = (edgeId: string, isHovered: boolean) =>
    setFlow((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === edgeId ? updateEdgeAppearance(edge, isHovered) : edge,
      ),
    }));

  return (
    <>
      <div ref={containerRef} className="relative h-full" onKeyDownCapture={handleKeyDownCapture}>
        <ReactFlow<RoadmapFlowNode, RoadmapFlowEdge>
          className="h-full"
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={roadmapNodeTypes}
          edgeTypes={roadmapEdgeTypes}
          nodesDraggable={canInteract}
          nodesConnectable={canInteract}
          snapToGrid
          snapGrid={[roadmapGridSize, roadmapGridSize]}
          connectionMode={ConnectionMode.Loose}
          nodesFocusable
          nodeDragThreshold={5}
          nodeClickDistance={6}
          elementsSelectable={isNavigationEnabled}
          panOnDrag={isNavigationEnabled}
          zoomOnScroll={isNavigationEnabled}
          zoomOnPinch={isNavigationEnabled}
          zoomOnDoubleClick={isNavigationEnabled}
          onNodesChange={handleNodesChange}
          onEdgesChange={(changes: EdgeChange<RoadmapFlowEdge>[]) =>
            setFlow((current) => ({
              ...current,
              edges: applyEdgeChanges(
                changes.filter((change) => change.type !== 'remove'),
                current.edges,
              ).map((edge) => (canEdit ? updateEdgeAppearance(edge) : edge)),
            }))
          }
          onNodeClick={(_event, node) => {
            if (node.data.blockReason) return;
            onSelectNode(node.id);
          }}
          onPaneClick={() => {
            if (isActionMenuActive) closeActionMenu(false);
          }}
          onEdgeMouseEnter={canEdit ? (_event, edge) => setEdgeHover(edge.id, true) : undefined}
          onEdgeMouseLeave={canEdit ? (_event, edge) => setEdgeHover(edge.id, false) : undefined}
          onNodeDragStop={
            canInteract
              ? (_event, node) => {
                  applyNodePositions(snappedNodePositions(immutableNodePositions([node])));
                }
              : undefined
          }
          onConnect={canInteract ? connectNodes : undefined}
          onEdgesDelete={
            canInteract ? (edges) => deleteDependencies(edges.map((edge) => edge.id)) : undefined
          }
          onMoveEnd={(event, viewport) => {
            if (!event) return;
            onViewportChange?.({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
          }}
          fitView
          fitViewOptions={roadmapFitViewOptions}
          proOptions={{ hideAttribution: true }}
        >
          <RoadmapGraphContents props={props} model={model} />
        </ReactFlow>
      </div>
      {model.useActionSheet ? (
        <NodeActionSheet
          node={flow.nodes.find((node) => node.id === openActionMenuNodeId)}
          onAction={model.requestNodeAction}
          onClose={closeActionMenu}
          finalFocus={model.actionMenuFinalFocus}
        />
      ) : null}
    </>
  );
}

function RoadmapGraphContents({
  props,
  model,
}: {
  props: RoadmapGraphProps;
  model: ReturnType<typeof useRoadmapGraphController>;
}) {
  const { overlaySlots, viewportRestoration, bottomLeftActions, bottomRightActions, onFitView } =
    props;
  const { canEdit, openActionMenuNodeId, containerRef, layoutDirection, flow, proposeAutoLayout } =
    model;
  return (
    <>
      {' '}
      <RoadmapGraphOverlays slots={overlaySlots} />
      <RoadmapViewportRestorer restoration={viewportRestoration} />
      <ActionMenuViewportAdjustment
        nodeId={canEdit && !model.useActionSheet ? openActionMenuNodeId : null}
        containerRef={containerRef}
      />
      <RoadmapGraphToolbar
        containerRef={containerRef}
        layoutDirection={layoutDirection}
        showAutoLayout={canEdit}
        canAutoLayout={canEdit && flow.nodes.length >= 2}
        onAutoLayout={proposeAutoLayout}
        onFitView={onFitView}
        bottomLeftActions={bottomLeftActions}
        bottomRightActions={bottomRightActions}
        nodes={flow.nodes}
      />
      <Background
        aria-label="Cuadrícula del lienzo"
        variant={BackgroundVariant.Lines}
        color="var(--fog)"
        gap={roadmapGridSize}
        size={1}
      />
    </>
  );
}
