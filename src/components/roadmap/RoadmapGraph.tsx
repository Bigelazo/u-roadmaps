'use client';

import { useEffect, useState } from 'react';
import {
  Background,
  ConnectionMode,
  MarkerType,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeDragHandler,
} from '@xyflow/react';
import type { RoadmapDto, RoadmapNode as RoadmapDomainNode } from '@/lib/roadmap-types';
import { studentNodeStatus } from '@/components/roadmap/node-status';
import {
  roadmapNodeTypes,
  type RoadmapNodeData,
  type RoadmapNodeStatus,
} from '@/components/roadmap/RoadmapNode';
import {
  roadmapEdgeTypes,
  type RoadmapDependencyEdgeData,
} from '@/components/roadmap/RoadmapDependencyEdge';

function nodeStatus(node: RoadmapDomainNode, canEdit: boolean): RoadmapNodeStatus {
  if (canEdit) return 'editing';
  return studentNodeStatus(node);
}

const selectedEdgeColor = 'var(--primary)';

function updateEdgeAppearance(edge: Edge, isHovered = false): Edge {
  const defaultStroke =
    typeof edge.data?.defaultStroke === 'string' ? edge.data.defaultStroke : 'var(--steel)';
  const isHighlighted = edge.selected || isHovered;
  const stroke = isHighlighted ? selectedEdgeColor : defaultStroke;
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
) {
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: Node<RoadmapNodeData>[] = roadmap.nodes.map((node) => ({
    id: node.id,
    type: 'roadmap',
    data: {
      title: node.title,
      typeName: nodeTypesById.get(node.nodeTypeId)?.name ?? 'Contenido',
      typeColor: nodeTypesById.get(node.nodeTypeId)?.color ?? 'var(--primary)',
      resourceCount: node.resources.length,
      status: nodeStatus(node, canEdit),
      isHidden: !node.isVisible,
    },
    position: { x: node.positionX, y: node.positionY },
    hidden: !canEdit && !node.isVisible,
    deletable: false,
  }));
  const edges: Edge<RoadmapDependencyEdgeData>[] = roadmap.dependencies.map((dependency) => {
    const isSourceCompleted = nodesById.get(dependency.sourceNodeId)?.isCompleted;
    const stroke = isSourceCompleted ? 'var(--ink)' : 'var(--steel)';
    return {
      id: dependency.id,
      source: dependency.sourceNodeId,
      target: dependency.targetNodeId,
      sourceHandle: dependency.sourceHandle,
      targetHandle: dependency.targetHandle,
      type: 'dependency',
      deletable: canEdit,
      data: { defaultStroke: stroke, onDelete: onDeleteDependency },
      style: { stroke, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
    };
  });
  return { nodes, edges };
}

type Props = {
  roadmap: RoadmapDto;
  canEdit: boolean;
  onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
  onMoveNode: NodeDragHandler;
  onConnectNodes: (connection: Connection) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
};

export function RoadmapGraph({
  roadmap,
  canEdit,
  onSelectNode,
  onMoveNode,
  onConnectNodes,
  onDeleteDependencies,
}: Props) {
  const [flow, setFlow] = useState(() =>
    mapRoadmapGraph(roadmap, canEdit, (dependencyId) => onDeleteDependencies([dependencyId])),
  );

  useEffect(() => {
    setFlow(
      mapRoadmapGraph(roadmap, canEdit, (dependencyId) => onDeleteDependencies([dependencyId])),
    );
  }, [roadmap, canEdit, onDeleteDependencies]);

  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      nodeTypes={roadmapNodeTypes}
      edgeTypes={roadmapEdgeTypes}
      nodesDraggable={canEdit}
      nodesConnectable={canEdit}
      connectionMode={ConnectionMode.Loose}
      nodesFocusable
      elementsSelectable
      deleteKeyCode={['Backspace', 'Delete']}
      onNodesChange={(changes: NodeChange[]) =>
        setFlow((current) => ({
          ...current,
          nodes: applyNodeChanges(
            changes.filter((change) => change.type !== 'remove'),
            current.nodes,
          ),
        }))
      }
      onEdgesChange={(changes: EdgeChange[]) =>
        setFlow((current) => ({
          ...current,
          edges: applyEdgeChanges(
            changes.filter((change) => change.type !== 'remove'),
            current.edges,
          ).map((edge) => updateEdgeAppearance(edge)),
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
      <Background color="var(--fog)" gap={20} size={1} />
    </ReactFlow>
  );
}
