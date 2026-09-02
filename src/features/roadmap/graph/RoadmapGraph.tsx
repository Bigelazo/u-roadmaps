'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  type OnNodeDrag,
} from '@xyflow/react';
import { LayoutTemplate } from 'lucide-react';
import { roadmapGridSize } from '@/lib/roadmap-geometry';
import { Button } from '@/shared/ui/button';
import type { AnyRoadmapDto } from '@/lib/roadmap-types';
import { type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import { roadmapNodeTypes } from '@/features/roadmap/graph/roadmap-node-types';
import { mapRoadmapGraph } from '@/features/roadmap/graph/map-roadmap-graph';
import { roadmapEdgeTypes, type RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import {
  layoutRoadmapGraph,
  type RoadmapLayoutDirection,
} from '@/features/roadmap/graph/dagre-layout';

const selectedEdgeColor = 'var(--primary)';

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
  topRightActions?: ReactNode;
};

export function RoadmapGraph({
  roadmap,
  canEdit,
  onSelectNode,
  onMoveNode,
  onConnectNodes,
  onDeleteDependencies,
  onAutoLayout,
  topRightActions,
}: Props) {
  const [layoutDirection, setLayoutDirection] = useState<RoadmapLayoutDirection>('TB');
  // El lienzo guarda las posiciones que el arrastre todavía no ha recargado, de
  // modo que solo un roadmap nuevo puede reemplazarlas. Las devoluciones viven
  // en una referencia para que un render del contenedor no rehaga el grafo.
  const handlers = useRef({ onDeleteDependencies });
  handlers.current = { onDeleteDependencies };
  const deleteDependency = useCallback(
    (dependencyId: string) => handlers.current.onDeleteDependencies([dependencyId]),
    [],
  );
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(roadmap, canEdit, deleteDependency),
  );

  useEffect(() => {
    setFlow(mapRoadmapGraph(roadmap, canEdit, deleteDependency));
  }, [roadmap, canEdit, deleteDependency]);

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

  return (
    <ReactFlow<RoadmapFlowNode, RoadmapFlowEdge>
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
      onNodesChange={(changes: NodeChange<RoadmapFlowNode>[]) =>
        setFlow((current) => ({
          ...current,
          nodes: applyNodeChanges(
            changes.filter((change) => change.type !== 'remove'),
            current.nodes,
          ),
        }))
      }
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
      fitViewOptions={{ padding: 0.28 }}
      proOptions={{ hideAttribution: true }}
    >
      {canEdit ? (
        <Panel position="top-right" className="mt-5 mr-5">
          <div className="flex flex-col items-stretch gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start sm:justify-center"
              disabled={flow.nodes.length < 2}
              onClick={applyAutoLayout}
            >
              <LayoutTemplate data-icon="inline-start" />
              Ordenar {layoutDirection === 'TB' ? 'horizontalmente' : 'verticalmente'}
            </Button>
            {topRightActions ? (
              <div className="flex justify-end gap-1.5">{topRightActions}</div>
            ) : null}
          </div>
        </Panel>
      ) : null}
      <Background
        aria-label="Cuadrícula del lienzo"
        variant={BackgroundVariant.Lines}
        color="var(--fog)"
        gap={roadmapGridSize}
        size={1}
      />
    </ReactFlow>
  );
}
