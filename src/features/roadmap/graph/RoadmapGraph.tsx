'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  useReactFlow,
} from '@xyflow/react';
import { LayoutTemplate, Maximize } from 'lucide-react';
import { roadmapGridSize, type NodeRect } from '@/features/roadmap/graph/geometry';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
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
  canAutoLayout,
  onAutoLayout,
  topRightActions,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  layoutDirection: RoadmapLayoutDirection;
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
  onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
  onMoveNode: OnNodeDrag<RoadmapFlowNode>;
  onConnectNodes: (connection: Connection) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
  onAutoLayout: (nodes: RoadmapFlowNode[]) => void;
  onClearSelectedNode?: () => void;
  onKeyboardNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
  selectedNodeId?: string | null;
  topRightActions?: (getViewport: () => NodeRect) => ReactNode;
};

export function RoadmapGraph({
  roadmap,
  canEdit,
  onSelectNode,
  onMoveNode,
  onConnectNodes,
  onDeleteDependencies,
  onAutoLayout,
  onClearSelectedNode,
  onKeyboardNodeMove,
  selectedNodeId,
  topRightActions,
}: Props) {
  const [layoutDirection, setLayoutDirection] = useState<RoadmapLayoutDirection>('TB');
  const [isAutoLayoutConfirmationOpen, setIsAutoLayoutConfirmationOpen] = useState(false);
  // El lienzo guarda las posiciones que el arrastre todavía no ha recargado, de
  // modo que solo un roadmap nuevo puede reemplazarlas. Las devoluciones viven
  // en una referencia para que un render del contenedor no rehaga el grafo.
  const handlers = useRef({ onDeleteDependencies });
  handlers.current = { onDeleteDependencies };
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const keyboardMovePendingRef = useRef(false);
  const deleteDependency = useCallback(
    (dependencyId: string) => handlers.current.onDeleteDependencies([dependencyId]),
    [],
  );
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(roadmap, canEdit, deleteDependency, selectedNodeId),
  );

  useEffect(() => {
    setFlow(mapRoadmapGraph(roadmap, canEdit, deleteDependency, selectedNodeIdRef.current));
  }, [roadmap, canEdit, deleteDependency]);

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

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="h-full"
      onKeyDownCapture={(event) => {
        const node = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
        if (!node) return;
        if (event.key === 'Escape' && node.dataset.id === selectedNodeIdRef.current) {
          onClearSelectedNode?.();
          return;
        }
        if (canEdit && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
          keyboardMovePendingRef.current = true;
      }}
    >
      <ReactFlow<RoadmapFlowNode, RoadmapFlowEdge>
        className="h-full"
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={roadmapNodeTypes}
        edgeTypes={roadmapEdgeTypes}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        snapToGrid
        snapGrid={[roadmapGridSize, roadmapGridSize]}
        connectionMode={ConnectionMode.Loose}
        nodesFocusable
        nodeDragThreshold={5}
        nodeClickDistance={6}
        elementsSelectable
        deleteKeyCode={['Backspace', 'Delete']}
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
        onNodeDragStop={canEdit ? onMoveNode : undefined}
        onConnect={canEdit ? connectNodes : undefined}
        onEdgesDelete={
          canEdit ? (edges) => onDeleteDependencies(edges.map((edge) => edge.id)) : undefined
        }
        fitView
        fitViewOptions={roadmapFitViewOptions}
        proOptions={{ hideAttribution: true }}
      >
        <RoadmapViewportControls />
        {canEdit ? (
          <RoadmapGraphToolbar
            containerRef={containerRef}
            layoutDirection={layoutDirection}
            canAutoLayout={flow.nodes.length >= 2}
            onAutoLayout={() => setIsAutoLayoutConfirmationOpen(true)}
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
      <AlertDialog
        open={isAutoLayoutConfirmationOpen}
        onOpenChange={setIsAutoLayoutConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar ordenamiento
            </AlertDialogTitle>
            <AlertDialogDescription>
              El ordenamiento automático reubicará los nodos del lienzo. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                setIsAutoLayoutConfirmationOpen(false);
                applyAutoLayout();
              }}
            >
              Ordenar nodos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
