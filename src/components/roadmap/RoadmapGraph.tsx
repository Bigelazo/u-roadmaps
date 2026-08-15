'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Background,
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
import { CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import { Box, Typography } from '@mui/material';
import type { RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { studentNodeStatus } from '@/components/roadmap/node-status';

type NodeStatus = 'completed' | 'available' | 'locked' | 'editing';
type CanvasNodeData = { title: string; typeName: string; status: NodeStatus };

function nodeStatus(node: RoadmapNode, canEdit: boolean): NodeStatus {
  if (canEdit) return 'editing';
  return studentNodeStatus(node);
}

function RoadmapCard({ data }: NodeProps<CanvasNodeData>) {
  const completed = data.status === 'completed';
  const locked = data.status === 'locked';
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
        borderRadius: '8px',
        bgcolor: locked ? '#fbfaff' : '#fff',
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
        {completed ? (
          <CheckCircle2 size={20} color="#0347bf" fill="#0347bf" stroke="#fff" />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="#fff4bd" stroke={accent} />
        )}
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
      <Typography sx={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.25 }}>
        {data.title}
      </Typography>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </Box>
  );
}

const nodeTypes = { roadmap: RoadmapCard };

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
    },
    position: { x: node.positionX, y: node.positionY },
    hidden: !node.isVisible,
    deletable: false,
  }));
  const edges: Edge[] = roadmap.dependencies.map((dependency) => {
    const isSourceCompleted = nodesById.get(dependency.sourceNodeId)?.isCompleted;
    const stroke = isSourceCompleted ? '#171720' : '#aeb9d4';
    return {
      id: dependency.id,
      source: dependency.sourceNodeId,
      target: dependency.targetNodeId,
      type: 'smoothstep',
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
};

export function RoadmapGraph({
  roadmap,
  canEdit,
  onSelectNode,
  onMoveNode,
  onConnectNodes,
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
      nodesFocusable
      elementsSelectable
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
          ),
        }))
      }
      onNodeClick={(event, node) => onSelectNode(node.id, event.currentTarget as HTMLElement)}
      onNodeDragStop={canEdit ? onMoveNode : undefined}
      onConnect={canEdit ? onConnectNodes : undefined}
      fitView
      fitViewOptions={{ padding: 0.28 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#e8eaf1" gap={20} size={1} />
    </ReactFlow>
  );
}
