'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  ConnectionMode,
  Handle,
  MarkerType,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeDragHandler,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CheckCircle2, Circle, EyeOff, LockKeyhole } from 'lucide-react';
import { Box, Typography } from '@mui/material';
import type { RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { studentNodeStatus } from '@/components/roadmap/node-status';

type NodeStatus = 'completed' | 'available' | 'locked' | 'editing';
type CanvasNodeData = {
  title: string;
  typeName: string;
  status: NodeStatus;
  isHidden: boolean;
};

function nodeStatus(node: RoadmapNode, canEdit: boolean): NodeStatus {
  if (canEdit) return 'editing';
  return studentNodeStatus(node);
}

function RoadmapCard({ data }: NodeProps<CanvasNodeData>) {
  const completed = data.status === 'completed';
  const locked = data.status === 'locked';
  const hidden = data.isHidden;
  const editing = data.status === 'editing';
  const accent = completed
    ? '#0347bf'
    : locked
      ? '#9294a2'
      : data.status === 'available'
        ? '#181812'
        : '#0347bf';
  return (
    <Box
      className="roadmap-card"
      sx={{
        minWidth: 170,
        border: '2px solid',
        borderColor: accent,
        borderStyle: hidden ? 'dashed' : 'solid',
        borderRadius: '8px',
        bgcolor: hidden ? '#f3f5f7' : locked ? '#fbfaff' : '#fff',
        color: locked ? '#9294a2' : '#171720',
        px: 2,
        py: 1.5,
        boxShadow: locked ? 'none' : '0 4px 10px rgba(22, 29, 58, 0.10)',
        opacity: locked ? 0.88 : 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1.25,
        }}
      >
        {hidden ? (
          <EyeOff size={19} color="#5a6474" aria-hidden="true" />
        ) : completed ? (
          <CheckCircle2 size={20} color="#0347bf" fill="#0347bf" stroke="#fff" />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="#fff4bd" stroke={accent} />
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.5 }}>
          {hidden ? (
            <Box
              sx={{
                borderRadius: 999,
                bgcolor: '#dce1e8',
                color: '#5a6474',
                px: 1,
                py: 0.15,
                fontSize: 12,
                lineHeight: 1.35,
              }}
            >
              Oculto para estudiantes
            </Box>
          ) : null}
          <Box
            sx={{
              borderRadius: 999,
              bgcolor: completed ? '#e1eaff' : locked ? '#eff0f5' : '#f1edfd',
              color: accent,
              px: 1,
              py: 0.15,
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            {completed ? 'Completado' : locked ? 'Bloqueado' : data.typeName}
          </Box>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.25 }}>
        {data.title}
      </Typography>
      {([
        ['top', Position.Top],
        ['right', Position.Right],
        ['bottom', Position.Bottom],
        ['left', Position.Left],
      ] as const).map(([id, position]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          style={{
            width: 12,
            height: 12,
            background: '#024ad8',
            border: '2px solid #fff',
            visibility: editing ? 'visible' : 'hidden',
          }}
        />
      ))}
    </Box>
  );
}

const nodeTypes = { roadmap: RoadmapCard };
const selectedEdgeColor = '#024ad8';

function updateEdgeAppearance(edge: Edge, isHovered = false): Edge {
  const defaultStroke =
    typeof edge.data?.defaultStroke === 'string' ? edge.data.defaultStroke : '#aeb9d4';
  const isHighlighted = edge.selected || isHovered;
  const stroke = isHighlighted ? selectedEdgeColor : defaultStroke;
  return {
    ...edge,
    style: { ...edge.style, stroke, strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 },
  };
}

export function mapRoadmapGraph(roadmap: RoadmapDto, canEdit: boolean) {
  const typeNames = new Map(roadmap.nodeTypes.map((type) => [type.id, type.name]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: Node<CanvasNodeData>[] = roadmap.nodes.map((node) => ({
    id: node.id,
    type: 'roadmap',
    data: {
      title: node.title,
      typeName: typeNames.get(node.nodeTypeId) ?? 'Contenido',
      status: nodeStatus(node, canEdit),
      isHidden: !node.isVisible,
    },
    position: { x: node.positionX, y: node.positionY },
    hidden: !canEdit && !node.isVisible,
    deletable: false,
  }));
  const edges: Edge[] = roadmap.dependencies.map((dependency) => {
    const isSourceCompleted = nodesById.get(dependency.sourceNodeId)?.isCompleted;
    const stroke = isSourceCompleted ? '#171720' : '#aeb9d4';
    return {
      id: dependency.id,
      source: dependency.sourceNodeId,
      target: dependency.targetNodeId,
      sourceHandle: dependency.sourceHandle,
      targetHandle: dependency.targetHandle,
      type: 'smoothstep',
      deletable: canEdit,
      data: { defaultStroke: stroke },
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
  onSelectDependency: (dependencyId: string) => void;
  onDeleteDependencies: (dependencyIds: string[]) => void;
};

export function RoadmapGraph({
  roadmap,
  canEdit,
  onSelectNode,
  onMoveNode,
  onConnectNodes,
  onSelectDependency,
  onDeleteDependencies,
}: Props) {
  const [flow, setFlow] = useState(() => mapRoadmapGraph(roadmap, canEdit));

  useEffect(() => {
    setFlow(mapRoadmapGraph(roadmap, canEdit));
  }, [roadmap, canEdit]);

  return (
    <ReactFlow
      nodes={flow.nodes}
      edges={flow.edges}
      nodeTypes={nodeTypes}
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
      onEdgeClick={canEdit ? (_event, edge) => onSelectDependency(edge.id) : undefined}
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
      <Background color="#e8eaf1" gap={20} size={1} />
    </ReactFlow>
  );
}
