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
import { CheckCircle2, Circle, EyeOff, LockKeyhole, Paperclip } from 'lucide-react';
import type { RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
import { studentNodeStatus } from '@/components/roadmap/node-status';

type NodeStatus = 'completed' | 'available' | 'locked' | 'editing';
type CanvasNodeData = {
  title: string;
  typeName: string;
  typeColor: string;
  resourceCount: number;
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
    ? '#176245'
    : locked
      ? '#9294a2'
      : data.status === 'available'
        ? '#181812'
        : '#0347bf';
  return (
    <div
      className={`min-w-[170px] cursor-pointer rounded-lg border-2 px-4 py-3 transition-[border-color,transform,box-shadow] hover:translate-y-[-2px] hover:!border-[#296ef9] hover:shadow-[0_0_0_4px_rgb(41_110_249_/_16%),0_9px_18px_rgb(2_74_216_/_18%)] ${hidden ? 'bg-cloud' : locked ? 'bg-[#fbfaff] opacity-[0.88] shadow-none' : 'bg-card shadow-[0_4px_10px_rgb(18_33_58_/_7%)]'}`}
      style={{ borderColor: accent }}
    >
      <div className="mb-5 flex items-center justify-between gap-2.5">
        {hidden ? (
          <EyeOff size={19} color="#5a6474" aria-hidden="true" />
        ) : completed ? (
          <CheckCircle2 size={20} color="#176245" fill="#176245" stroke="#fff" />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="#fff4bd" stroke={accent} />
        )}
        <div className="flex flex-wrap justify-end gap-1">
          {hidden ? (
            <span className="rounded-full bg-fog px-2 py-0.5 text-xs leading-[1.35] text-graphite">
              Oculto para estudiantes
            </span>
          ) : null}
          <span
            className={
              completed
                ? 'rounded-full bg-progress-soft px-2 py-0.5 text-xs leading-[1.35] text-progress-deep'
                : locked
                  ? 'rounded-full bg-cloud px-2 py-0.5 text-xs leading-[1.35] text-graphite'
                  : 'bg-primary-soft rounded-full px-2 py-0.5 text-xs leading-[1.35] text-primary-deep'
            }
          >
            {completed ? 'Completado' : locked ? 'Bloqueado' : editing ? 'Edición' : 'Disponible'}
          </span>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: data.typeColor }} />
        <span>{data.typeName}</span>
        {data.resourceCount ? (
          <button
            type="button"
            className="nodrag ml-auto flex min-h-11 items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Ver ${data.resourceCount} ${data.resourceCount === 1 ? 'recurso' : 'recursos'}`}
          >
            <Paperclip size={14} aria-hidden="true" />
            {data.resourceCount} {data.resourceCount === 1 ? 'recurso' : 'recursos'}
          </button>
        ) : null}
      </div>
      <p className="text-[15.5px] leading-[1.25] font-medium text-ink">{data.title}</p>
      {(
        [
          ['top', Position.Top],
          ['right', Position.Right],
          ['bottom', Position.Bottom],
          ['left', Position.Left],
        ] as const
      ).map(([id, position]) => (
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
    </div>
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
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: Node<CanvasNodeData>[] = roadmap.nodes.map((node) => ({
    id: node.id,
    type: 'roadmap',
    data: {
      title: node.title,
      typeName: nodeTypesById.get(node.nodeTypeId)?.name ?? 'Contenido',
      typeColor: nodeTypesById.get(node.nodeTypeId)?.color ?? '#024ad8',
      resourceCount: node.resources.length,
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
