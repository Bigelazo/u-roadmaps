'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import { Button } from '@/components/ui/button';
import type { RoadmapDto, RoadmapNode as RoadmapDomainNode } from '@/lib/roadmap-types';
import { studentNodeStatus } from '@/features/roadmap/student/node-status';
import {
  roadmapNodeTypes,
  type RoadmapFlowNode,
  type RoadmapNodeStatus,
} from '@/features/roadmap/graph/RoadmapNode';
import { roadmapEdgeTypes, type RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import {
  layoutRoadmapGraph,
  type RoadmapLayoutDirection,
} from '@/features/roadmap/graph/dagre-layout';

function nodeStatus(node: RoadmapDomainNode, canEdit: boolean): RoadmapNodeStatus {
  if (canEdit) return 'editing';
  return studentNodeStatus(node);
}

const studentEdgeStroke = 'var(--ink)';
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

export function mapRoadmapGraph(
  roadmap: RoadmapDto,
  canEdit: boolean,
  onDeleteDependency?: (dependencyId: string) => void,
  onToggleNodeVisibility?: (nodeId: string, isVisible: boolean) => void,
) {
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: RoadmapFlowNode[] = roadmap.nodes.map((node) => ({
    id: node.id,
    type: 'roadmap',
    data: {
      title: node.title,
      typeColor: nodeTypesById.get(node.nodeTypeId)?.color ?? 'var(--primary)',
      typeName: nodeTypesById.get(node.nodeTypeId)?.name ?? 'Sin tipo',
      status: nodeStatus(node, canEdit),
      isHidden: !node.isVisible,
      onToggleVisibility: canEdit
        ? () => onToggleNodeVisibility?.(node.id, node.isVisible)
        : undefined,
    },
    position: { x: node.positionX, y: node.positionY },
    hidden: !canEdit && !node.isVisible,
    deletable: false,
  }));
  const edges: RoadmapFlowEdge[] = roadmap.dependencies.map((dependency) => {
    const defaultStroke = canEdit
      ? nodesById.get(dependency.sourceNodeId)?.isCompleted
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

type Props = {
  roadmap: RoadmapDto;
  canEdit: boolean;
  onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
  onMoveNode: OnNodeDrag<RoadmapFlowNode>;
  onConnectNodes: (connection: Connection) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
  onToggleNodeVisibility: (nodeId: string, isVisible: boolean) => void;
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
  onToggleNodeVisibility,
  onAutoLayout,
  topRightActions,
}: Props) {
  const [layoutDirection, setLayoutDirection] = useState<RoadmapLayoutDirection>('TB');
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(
      roadmap,
      canEdit,
      (dependencyId) => onDeleteDependencies([dependencyId]),
      onToggleNodeVisibility,
    ),
  );

  useEffect(() => {
    setFlow(
      mapRoadmapGraph(
        roadmap,
        canEdit,
        (dependencyId) => onDeleteDependencies([dependencyId]),
        onToggleNodeVisibility,
      ),
    );
  }, [roadmap, canEdit, onDeleteDependencies, onToggleNodeVisibility]);

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
      onNodeClick={(event, node) => onSelectNode(node.id, event.currentTarget as HTMLElement)}
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
      onConnect={canEdit ? onConnectNodes : undefined}
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
