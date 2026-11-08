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
  Panel,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useNodesInitialized,
  useReactFlow,
  useUpdateNodeInternals,
  type FitViewOptions,
} from '@xyflow/react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { LayoutFreeform, LockKeyhole, Maximize } from 'lucide-react';
import {
  findOpenRoadmapPosition,
  roadmapGridSize,
  roadmapNodeSizeForTitle,
  snapToRoadmapGrid,
} from '@/features/roadmap/graph/geometry';
import type { NodeActionCallbacks, NodeActionIntent } from '@/features/roadmap/graph/node-action';
import { nodeActionMenuCloseDurationMs } from '@/features/roadmap/graph/node-menu-actions';
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
import { DependencyRouting } from '@/features/roadmap/graph/routing/DependencyRouting';
import {
  DependencyAnimationProvider,
  DependencyAnimationReady,
  type DependencyAnimationControls,
} from '@/features/roadmap/graph/DependencyAnimation';
import { useWholeNodeConnection } from '@/features/roadmap/graph/use-whole-node-connection';
import {
  ConnectionPreview,
  ConnectionTargetContext,
  TouchConnectionPreview,
} from '@/features/roadmap/graph/ConnectionPreview';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import { NodeName, type NodeNameType } from '@/features/roadmap/ui/NodeName';
import {
  pendingPrerequisites,
  studentNodeBlockMessages,
  studentNodeBlockReason,
  studentNodeStatus,
} from '@/features/roadmap/student/node-status';
import { useCompactCanvasLayout } from '@/features/roadmap/ui/compact-canvas-layout';
import {
  TUTORIAL_REVEAL_EVENT,
  type TutorialRevealDetail,
} from '@/shared/client/tutorial/tutorial-support';
import { cn } from 'cn';
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
const roadmapFitViewOptions = { padding: 0.28, minZoom: 0.5 };
const roadmapMinZoom = 0.2;
const roadmapMaxZoom = 2;
const studentReadableZoom = 0.8;
const staffReadableZoom = 0.7;
const tutorialLegibleZoom = 0.5;
const overlayGap = 12;
const sideInset = 16;
const roadmapDependencyHandles = ['top', 'right', 'bottom', 'left'] as const;
const dependencyStroke = 'var(--ink)';
const bottomRightPanelClassName =
  'pointer-events-none mr-4! mb-[18px]! grid w-[min(23rem,calc(100%-2.5rem))] items-end justify-items-end sm:mr-6! [&>*]:col-start-1 [&>*]:row-start-1';

type CanvasInsets = { top: number; right: number; bottom: number; left: number };

function canvasOverlayInsets(container: HTMLElement | null): CanvasInsets {
  const insets = { top: sideInset, right: sideInset, bottom: sideInset, left: sideInset };
  if (!container) return insets;
  const canvas = container.getBoundingClientRect();
  container.querySelectorAll<HTMLElement>('[data-canvas-overlay]').forEach((overlay) => {
    const rect = overlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (overlay.dataset.canvasOverlay === 'top')
      insets.top = Math.max(insets.top, rect.bottom - canvas.top + overlayGap);
    else insets.bottom = Math.max(insets.bottom, canvas.bottom - rect.top + overlayGap);
  });
  const vertical = insets.top + insets.bottom;
  const maxVertical = canvas.height - 96;
  if (maxVertical > 0 && vertical > maxVertical) {
    insets.top *= maxVertical / vertical;
    insets.bottom *= maxVertical / vertical;
  }
  return insets;
}

function insetPadding(insets: CanvasInsets): NonNullable<FitViewOptions['padding']> {
  const px = (value: number) => `${Math.round(value)}px` as const;
  return {
    top: px(insets.top),
    right: px(insets.right),
    bottom: px(insets.bottom),
    left: px(insets.left),
  };
}

function fitAllOptions(compact: boolean, container: HTMLElement | null): FitViewOptions {
  return compact
    ? { padding: insetPadding(canvasOverlayInsets(container)), minZoom: roadmapMinZoom, maxZoom: 1 }
    : { ...roadmapFitViewOptions, minZoom: roadmapMinZoom };
}

function readingOrder(nodes: readonly RoadmapFlowNode[]) {
  return [...nodes]
    .filter((node) => !node.hidden)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

function nodeRect(node: RoadmapFlowNode) {
  return { ...node.position, ...roadmapNodeSizeForTitle(node.data.title) };
}

function compactInitialViewport(
  nodes: readonly RoadmapFlowNode[],
  isStudent: boolean,
  canvas: { width: number; height: number },
  insets: CanvasInsets,
) {
  const ordered = readingOrder(nodes);
  if (!ordered.length) return null;
  const rects = ordered.map(nodeRect);
  const bounds = {
    x: Math.min(...rects.map((rect) => rect.x)),
    y: Math.min(...rects.map((rect) => rect.y)),
    right: Math.max(...rects.map((rect) => rect.x + rect.width)),
    bottom: Math.max(...rects.map((rect) => rect.y + rect.height)),
  };
  const width = Math.max(1, canvas.width - insets.left - insets.right);
  const height = Math.max(1, canvas.height - insets.top - insets.bottom);
  const fitZoom = Math.min(
    1,
    width / Math.max(1, bounds.right - bounds.x),
    height / Math.max(1, bounds.bottom - bounds.y),
  );
  const readableZoom = isStudent ? studentReadableZoom : staffReadableZoom;
  if (fitZoom >= readableZoom) {
    return {
      zoom: fitZoom,
      x: insets.left + (width - (bounds.right - bounds.x) * fitZoom) / 2 - bounds.x * fitZoom,
      y: insets.top + (height - (bounds.bottom - bounds.y) * fitZoom) / 2 - bounds.y * fitZoom,
    };
  }
  if (isStudent) {
    const focus =
      ordered.find((node) => node.data.status === 'available' && !node.data.blockReason) ??
      ordered[0];
    const rect = nodeRect(focus);
    const zoom = Math.min(1, Math.max(readableZoom, width / (rect.width + 2 * sideInset)));
    return {
      zoom,
      x: insets.left + width / 2 - (rect.x + rect.width / 2) * zoom,
      y: insets.top + height * 0.4 - (rect.y + rect.height / 2) * zoom,
    };
  }
  const first = nodeRect(ordered[0]);
  const zoom = readableZoom;
  return {
    zoom,
    x: insets.left + width / 2 - (first.x + first.width / 2) * zoom,
    y: insets.top + overlayGap - first.y * zoom,
  };
}

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
        typeName: nodeType?.name ?? unknownNodeType.name,
        typeIcon: nodeType?.icon ?? unknownNodeType.icon,
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
    const defaultStroke = isTeacherView && !canEdit ? '#000' : dependencyStroke;
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
    };
  });
  return { nodes, edges };
}

function keepMeasuredNodes(
  flow: ReturnType<typeof mapProjectionToFlow>,
  current: ReturnType<typeof mapProjectionToFlow>,
) {
  const measuredById = new Map(current.nodes.map((node) => [node.id, node.measured]));
  return {
    ...flow,
    nodes: flow.nodes.map((node) => ({ ...node, measured: measuredById.get(node.id) })),
  };
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
    const topLeft = screenToFlowPosition({ x: bounds.left, y: bounds.top }, { snapToGrid: false });
    const bottomRight = screenToFlowPosition(
      { x: bounds.right, y: bounds.bottom },
      { snapToGrid: false },
    );
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

  const compact = useCompactCanvasLayout();

  return (
    <>
      <Panel
        position="bottom-left"
        data-canvas-overlay="bottom"
        className={cn(
          'm-4! sm:m-6!',
          bottomRightActions
            ? 'max-w-[calc(100%-2rem-4.75rem)] sm:max-w-[calc(100%-3rem-5.25rem)]'
            : 'max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-3rem)]',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm',
            compact ? 'flex-nowrap overflow-x-auto overscroll-x-contain' : 'flex-wrap',
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Centrar mapa"
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    void fitView(fitAllOptions(compact, containerRef.current)).then(() =>
                      onFitView?.(),
                    )
                  }
                >
                  <Maximize aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Centrar mapa</TooltipContent>
          </Tooltip>
          {showAutoLayout ? (
            compact ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Ordenar"
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!canAutoLayout}
                      onClick={onAutoLayout}
                    >
                      <LayoutFreeform aria-hidden="true" />
                    </Button>
                  }
                />
                <TooltipContent>Ordenar</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAutoLayout}
                onClick={onAutoLayout}
              >
                <LayoutFreeform data-icon="inline-start" />
                Ordenar
              </Button>
            )
          ) : null}
          {bottomLeftActions ? (
            <div
              className={cn(
                'flex gap-1.5',
                compact
                  ? 'flex-nowrap *:w-11! *:shrink-0 *:gap-0! *:p-0! *:text-[0px]!'
                  : 'flex-wrap',
              )}
            >
              {bottomLeftActions(findOpenPosition)}
            </div>
          ) : null}
        </div>
      </Panel>
      {bottomRightActions ? (
        <Panel
          position="bottom-right"
          data-canvas-overlay="bottom"
          className={bottomRightPanelClassName}
        >
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

function NodeMeasurementRecovery({ nodes }: { nodes: readonly RoadmapFlowNode[] }) {
  const { getInternalNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    const withoutHandleBounds = nodes.flatMap((node) =>
      !node.hidden && !getInternalNode(node.id)?.internals.handleBounds ? [node.id] : [],
    );
    if (withoutHandleBounds.length > 0) updateNodeInternals(withoutHandleBounds);
  }, [getInternalNode, nodes, updateNodeInternals]);
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
  const defaultStroke = edge.data?.defaultStroke ?? dependencyStroke;
  const stroke = edge.selected || isHovered ? selectedEdgeColor : defaultStroke;
  return {
    ...edge,
    style: { ...edge.style, stroke, strokeWidth: 1.5 },
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
  onFitView?: () => void;
};

export type RoadmapGraphOverlaySlots = {
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  bottomRight?: ReactNode;
};

const titlePlateClassName = cn(
  'pointer-events-none rounded-lg border border-border/70 bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm',
  '[@media(max-height:500px)]:py-1.5 [@media(max-height:500px)]:[&_h1]:mt-1 [@media(max-height:500px)]:[&_h1]:text-xl',
);

function RoadmapGraphOverlays({ slots }: { slots?: RoadmapGraphOverlaySlots }) {
  const compact = useCompactCanvasLayout();
  const stackTitleUnderToolbar = compact && Boolean(slots?.topCenter && slots.topLeft);
  return (
    <>
      {slots?.topLeft && !stackTitleUnderToolbar ? (
        <Panel
          position="top-left"
          data-canvas-overlay="top"
          className={cn(
            'z-4! m-4! sm:m-6!',
            titlePlateClassName,
            slots.topRight
              ? 'max-w-[calc(100%-2rem-3.5rem)] sm:max-w-[min(28rem,calc(100%-3rem-3.5rem))]'
              : 'max-w-[calc(100%-2rem)] sm:max-w-md',
          )}
        >
          {slots.topLeft}
        </Panel>
      ) : null}
      {slots?.topCenter ? (
        <Panel
          position="top-center"
          data-canvas-overlay="top"
          className={cn(
            'mt-3! w-[calc(100%-2rem)] max-w-xl',
            stackTitleUnderToolbar
              ? 'pointer-events-none flex flex-col items-start gap-2'
              : 'sm:w-auto',
          )}
        >
          {slots.topCenter}
          {stackTitleUnderToolbar ? (
            <div
              className={cn(titlePlateClassName, 'max-w-full [@media(max-height:500px)]:hidden')}
            >
              {slots.topLeft}
            </div>
          ) : null}
        </Panel>
      ) : null}
      {slots?.topRight ? (
        <Panel position="top-right" className="m-4! sm:m-6!">
          {slots.topRight}
        </Panel>
      ) : null}
      {slots?.bottomRight ? (
        <Panel
          position="bottom-right"
          data-canvas-overlay="bottom"
          className={bottomRightPanelClassName}
        >
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
  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );
  const beginClosing = useCallback(
    (nodeId: string) => {
      if (!editing || useActionSheet) return;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setClosingMenu({ editing, selectedNodeId: selectedNodeIdRef.current, nodeId });
      closeTimerRef.current = setTimeout(() => setClosingMenu(null), nodeActionMenuCloseDurationMs);
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
      if (closingNodeId === nodeId) {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setClosingMenu(null);
      }
      if (openNodeId) beginClosing(openNodeId);
      restoreFocusRef.current = true;
      setOpenMenu({ editing, selectedNodeId: selectedNodeIdRef.current, nodeId });
    },
    [beginClosing, closeActionMenu, closingNodeId, editing, openNodeId, selectedNodeIdRef],
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
  const onEditingIntent = editing?.onEditingIntent;
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
    setFlow((current) =>
      keepMeasuredNodes(
        mapProjectionToFlow(
          stableProjection,
          deleteDependency,
          selectedNodeIdRef.current,
          actionMenu,
          notificationsEnabled,
        ),
        current,
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
    const layoutIn = (direction: RoadmapLayoutDirection) =>
      freezeNodePositions(
        changedNodePositions(
          flow.nodes,
          immutableNodePositions(layoutRoadmapGraph(flow.nodes, flow.edges, direction)),
        ),
      );
    const layouts = Object.freeze({ TB: layoutIn('TB'), LR: layoutIn('LR') });
    if (layouts.TB.length === 0 && layouts.LR.length === 0) return;
    emitEditingIntent({ kind: 'apply-automatic-layout', layouts });
  }, [emitEditingIntent, flow.edges, flow.nodes]);

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

  const compact = useCompactCanvasLayout();
  const [blockedNoticeNodeId, setBlockedNoticeNodeId] = useState<string | null>(null);
  const isActionMenuActive = Boolean(openActionMenuNodeId || closingActionMenuNodeId);
  const isNavigationEnabled = !isActionMenuActive;
  const canInteract = canEdit && isNavigationEnabled;
  const dependencyAnimationRef = useRef<DependencyAnimationControls | null>(null);
  const connection = useWholeNodeConnection({
    nodes: flow.nodes,
    edges: flow.edges,
    enabled: canInteract,
    onConnect: connectNodes,
  });
  const connectionNodes = useMemo(
    () =>
      flow.nodes.map((node) => ({
        ...node,
        className:
          node.id === connection.arrowSourceId
            ? 'roadmap-node--arrow-source'
            : node.id === connection.targetId
              ? 'roadmap-node--connection-target'
              : undefined,
      })),
    [flow.nodes, connection.targetId, connection.arrowSourceId],
  );
  const targetNode = flow.nodes.find((node) => node.id === connection.targetId);
  const targetRect = targetNode
    ? {
        id: targetNode.id,
        ...targetNode.position,
        ...roadmapNodeSizeForTitle(targetNode.data.title),
      }
    : null;
  const arrowSourceNode = flow.nodes.find((node) => node.id === connection.arrowSourceId);
  const arrowSourceRect = arrowSourceNode
    ? { ...arrowSourceNode.position, ...roadmapNodeSizeForTitle(arrowSourceNode.data.title) }
    : null;

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && connection.arrowSourceId) {
      event.preventDefault();
      event.stopPropagation();
      connection.cancelArrowMode();
      return;
    }
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
    if (positions.length > 0) dependencyAnimationRef.current?.finish();
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
      <div
        ref={containerRef}
        className="relative h-full"
        onKeyDownCapture={handleKeyDownCapture}
        onMouseMoveCapture={connection.onPointerMove}
        onTouchStartCapture={connection.onTouchStartCapture}
        onTouchMoveCapture={connection.onPointerMove}
        onTouchEndCapture={connection.onTouchEndCapture}
        onTouchCancelCapture={connection.onTouchCancelCapture}
        onContextMenuCapture={connection.onContextMenuCapture}
        onClickCapture={connection.onClickCapture}
      >
        <DependencyAnimationProvider
          edges={flow.edges}
          nodeIds={flow.nodes.map((node) => node.id)}
          controlsRef={dependencyAnimationRef}
        >
          <DependencyRouting nodes={flow.nodes} edges={flow.edges}>
            <ConnectionTargetContext value={targetRect}>
              <ReactFlow<RoadmapFlowNode, RoadmapFlowEdge>
                className="h-full"
                nodes={connectionNodes}
                edges={flow.edges}
                nodeTypes={roadmapNodeTypes}
                edgeTypes={roadmapEdgeTypes}
                nodesDraggable={canInteract && !connection.arrowSourceId}
                nodesConnectable={canInteract}
                snapToGrid
                snapGrid={[roadmapGridSize, roadmapGridSize]}
                connectionMode={ConnectionMode.Loose}
                connectOnClick={false}
                connectionLineComponent={ConnectionPreview}
                isValidConnection={connection.isValidConnection}
                nodesFocusable
                nodeDragThreshold={5}
                nodeClickDistance={6}
                elementsSelectable={isNavigationEnabled}
                panOnDrag={isNavigationEnabled && !connection.arrowSourceId}
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
                  if (node.data.blockReason) {
                    setBlockedNoticeNodeId((current) => (current === node.id ? null : node.id));
                    return;
                  }
                  setBlockedNoticeNodeId(null);
                  onSelectNode(node.id);
                }}
                onPaneClick={() => {
                  setBlockedNoticeNodeId(null);
                  if (isActionMenuActive) closeActionMenu(false);
                  if (compact && props.selectedNodeId) onClearSelectedNode?.();
                }}
                onMoveStart={(event) => {
                  if (event) setBlockedNoticeNodeId(null);
                }}
                onEdgeMouseEnter={
                  canEdit ? (_event, edge) => setEdgeHover(edge.id, true) : undefined
                }
                onEdgeMouseLeave={
                  canEdit ? (_event, edge) => setEdgeHover(edge.id, false) : undefined
                }
                onNodeDragStop={
                  canInteract
                    ? (_event, node) => {
                        applyNodePositions(snappedNodePositions(immutableNodePositions([node])));
                      }
                    : undefined
                }
                onNodeDragStart={() => dependencyAnimationRef.current?.finish()}
                onConnectStart={canInteract ? connection.onConnectStart : undefined}
                onConnectEnd={canInteract ? connection.onConnectEnd : undefined}
                onConnect={canInteract ? connection.onConnect : undefined}
                onEdgesDelete={
                  canInteract
                    ? (edges) => deleteDependencies(edges.map((edge) => edge.id))
                    : undefined
                }
                onMoveEnd={(event, viewport) => {
                  if (!event) return;
                  onViewportChange?.({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
                }}
                fitView={!compact}
                fitViewOptions={roadmapFitViewOptions}
                minZoom={roadmapMinZoom}
                maxZoom={roadmapMaxZoom}
                proOptions={{ hideAttribution: true }}
              >
                <RoadmapGraphContents
                  props={props}
                  model={model}
                  onAutoLayout={() => {
                    dependencyAnimationRef.current?.finish();
                    model.proposeAutoLayout();
                  }}
                />
                <DependencyAnimationReady />
                <BlockedNodeNotice
                  nodeId={blockedNoticeNodeId}
                  roadmap={props.projection.roadmap}
                  containerRef={containerRef}
                  onClose={() => setBlockedNoticeNodeId(null)}
                />
                {arrowSourceRect ? (
                  <TouchConnectionPreview
                    source={arrowSourceRect}
                    sourceId={connection.arrowSourceId!}
                    targetId={connection.targetId}
                    target={targetRect}
                    pointer={connection.arrowPointer}
                  />
                ) : null}
              </ReactFlow>
            </ConnectionTargetContext>
          </DependencyRouting>
        </DependencyAnimationProvider>
        {connection.arrowSourceId ? (
          <div
            data-arrow-mode-controls
            className="pointer-events-none absolute inset-x-4 top-32 z-30 flex justify-center [@media(max-height:500px)]:top-2"
          >
            <div
              role="status"
              aria-live="polite"
              className="flex max-w-md flex-wrap items-center justify-center gap-3 rounded-lg border border-primary bg-card px-4 py-3 text-sm text-foreground shadow-md"
            >
              <span>{connection.arrowMessage}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Cancelar modo flecha"
                className="pointer-events-auto"
                onClick={connection.cancelArrowMode}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
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
  onAutoLayout,
}: {
  props: RoadmapGraphProps;
  model: ReturnType<typeof useRoadmapGraphController>;
  onAutoLayout: () => void;
}) {
  const { overlaySlots, viewportRestoration, bottomLeftActions, bottomRightActions, onFitView } =
    props;
  const { canEdit, openActionMenuNodeId, containerRef, flow } = model;
  return (
    <>
      {' '}
      <RoadmapGraphOverlays slots={overlaySlots} />
      <RoadmapViewportRestorer restoration={viewportRestoration} />
      <CompactInitialViewport
        nodes={flow.nodes}
        isStudent={props.projection.kind === 'student'}
        skip={Boolean(viewportRestoration)}
        containerRef={containerRef}
      />
      <TutorialRevealTarget containerRef={containerRef} />
      <NodeMeasurementRecovery nodes={flow.nodes} />
      <ActionMenuViewportAdjustment
        nodeId={canEdit && !model.useActionSheet ? openActionMenuNodeId : null}
        containerRef={containerRef}
      />
      <RoadmapGraphToolbar
        containerRef={containerRef}
        showAutoLayout={canEdit}
        canAutoLayout={canEdit && flow.nodes.length >= 2}
        onAutoLayout={onAutoLayout}
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
      />
    </>
  );
}

function CompactInitialViewport({
  nodes,
  isStudent,
  skip,
  containerRef,
}: {
  nodes: readonly RoadmapFlowNode[];
  isStudent: boolean;
  skip: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const compact = useCompactCanvasLayout();
  const initialized = useNodesInitialized();
  const { setViewport } = useReactFlow();
  const appliedRef = useRef(false);
  useEffect(() => {
    if (!compact || skip || appliedRef.current || !initialized) return;
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || appliedRef.current) return;
      const viewport = compactInitialViewport(
        nodes,
        isStudent,
        { width: container.clientWidth, height: container.clientHeight },
        canvasOverlayInsets(container),
      );
      if (!viewport) return;
      appliedRef.current = true;
      void setViewport(viewport);
    });
    return () => cancelAnimationFrame(frame);
  }, [compact, containerRef, initialized, isStudent, nodes, setViewport, skip]);
  return null;
}

function TutorialRevealTarget({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { fitView, getZoom } = useReactFlow();
  const compact = useCompactCanvasLayout();
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<TutorialRevealDetail>).detail;
      const nodeElements = detail.elements.flatMap((element) => {
        const node = element.closest<HTMLElement>('.react-flow__node');
        return node && container.contains(node) ? [node] : [];
      });
      if (!nodeElements.length) return;
      const insets = canvasOverlayInsets(container);
      const canvas = container.getBoundingClientRect();
      const visible = nodeElements.every((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.left - 10 >= canvas.left + insets.left &&
          rect.right + 10 <= canvas.right - insets.right &&
          rect.top - 10 >= canvas.top + insets.top &&
          rect.bottom + 10 <= canvas.bottom - insets.bottom
        );
      });
      const zoom = getZoom();
      if (visible && (!compact || zoom >= tutorialLegibleZoom)) return;
      detail.waitUntil(
        fitView({
          nodes: nodeElements.map((node) => ({ id: node.dataset.id ?? '' })),
          padding: insetPadding({
            top: insets.top + 12,
            right: insets.right + 12,
            bottom: insets.bottom + 12,
            left: insets.left + 12,
          }),
          minZoom: roadmapMinZoom,
          maxZoom: Math.max(zoom, compact ? studentReadableZoom : 0.5),
          duration: 300,
        }).then(() => undefined),
      );
    };
    container.addEventListener(TUTORIAL_REVEAL_EVENT, reveal);
    return () => container.removeEventListener(TUTORIAL_REVEAL_EVENT, reveal);
  }, [compact, containerRef, fitView, getZoom]);
  return null;
}

type BlockedNodeExplanation = {
  title: string;
  description: string;
  prerequisites: { id: string; title: string; nodeType: NodeNameType }[];
};

function blockedNodeExplanation(
  roadmap: RoadmapGraphProjection['roadmap'],
  nodeId: string,
): BlockedNodeExplanation | null {
  const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
  const reason = node ? studentNodeBlockReason(node) : undefined;
  if (!node || !reason) return null;
  if (reason === 'TEACHER_BLOCK')
    return {
      title: studentNodeBlockMessages.TEACHER_BLOCK,
      description: 'El equipo docente lo liberará cuando lo decida.',
      prerequisites: [],
    };
  const prerequisites = pendingPrerequisites(roadmap, nodeId).map((source) => ({
    id: source.id,
    title: source.title,
    nodeType:
      roadmap.nodeTypes.find((candidate) => candidate.id === source.nodeTypeId) ?? unknownNodeType,
  }));
  return {
    title: studentNodeBlockMessages.PREREQUISITE_BLOCK,
    description: prerequisites.length
      ? 'Para abrirlo, completa antes:'
      : 'Este nodo se desbloquea cuando completes sus prerrequisitos.',
    prerequisites,
  };
}

function BlockedNodeNotice({
  nodeId,
  roadmap,
  containerRef,
  onClose,
}: {
  nodeId: string | null;
  roadmap: RoadmapGraphProjection['roadmap'];
  containerRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(nodeId);
  if (nodeId && nodeId !== shown) setShown(nodeId);
  const explanation = shown ? blockedNodeExplanation(roadmap, shown) : null;
  const nodeTitle = roadmap.nodes.find((node) => node.id === shown)?.title;
  return (
    <PopoverPrimitive.Root
      open={Boolean(nodeId && explanation)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          key={shown}
          anchor={() =>
            shown
              ? (containerRef.current?.querySelector(`.react-flow__node[data-id="${shown}"]`) ??
                null)
              : null
          }
          side="bottom"
          sideOffset={14}
          collisionPadding={16}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            initialFocus={false}
            finalFocus={false}
            className="flex w-72 max-w-[calc(100vw-2rem)] origin-(--transform-origin) gap-3 rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-graphite" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-1">
              <PopoverPrimitive.Title className="font-semibold text-ink">
                {explanation?.title}
              </PopoverPrimitive.Title>
              <PopoverPrimitive.Description className="text-muted-foreground">
                {nodeTitle ? <span className="sr-only">{nodeTitle}: </span> : null}
                {explanation?.description}
              </PopoverPrimitive.Description>
              {explanation?.prerequisites.length ? (
                <ul
                  aria-label="Prerrequisitos pendientes"
                  className="mx-auto mt-1 flex w-fit max-w-full flex-col gap-1"
                >
                  {explanation.prerequisites.map((prerequisite) => (
                    <li key={prerequisite.id} className="min-w-0 break-words">
                      <NodeName title={prerequisite.title} nodeType={prerequisite.nodeType} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
