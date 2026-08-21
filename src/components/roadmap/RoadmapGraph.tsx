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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    ? 'var(--progress-deep)'
    : locked
      ? 'var(--steel)'
      : data.status === 'available'
        ? 'var(--ink)'
        : 'var(--primary)';
  const statusLabel = completed
    ? 'Completado'
    : locked
      ? 'Bloqueado'
      : editing
        ? 'Edición'
        : 'Disponible';
  return (
    <div
      data-slot="roadmap-card"
      className={cn(
        'min-w-[170px] cursor-pointer rounded-lg border-2 px-4 py-3 transition-[border-color,transform,box-shadow] hover:translate-y-[-2px] hover:!border-primary-bright hover:shadow-[var(--shadow-roadmap-node-hover)] motion-reduce:transform-none motion-reduce:transition-none',
        hidden
          ? 'bg-cloud'
          : locked
            ? 'bg-cloud opacity-[0.88] shadow-none'
            : 'bg-card shadow-[var(--shadow-roadmap-node)]',
      )}
      style={{ borderColor: accent }}
    >
      <div className="mb-5 flex items-center justify-between gap-2.5">
        {hidden ? (
          <EyeOff size={19} color="var(--graphite)" aria-hidden="true" />
        ) : completed ? (
          <CheckCircle2
            size={20}
            color="var(--progress-deep)"
            fill="var(--progress-deep)"
            stroke="var(--card)"
          />
        ) : locked ? (
          <LockKeyhole size={18} />
        ) : (
          <Circle size={19} fill="var(--primary-soft)" stroke={accent} />
        )}
        <div className="flex flex-wrap justify-end gap-1">
          {hidden ? (
            <Badge variant="secondary" className="bg-fog text-graphite">
              Oculto para estudiantes
            </Badge>
          ) : null}
          <Badge
            className={
              completed
                ? 'bg-progress-soft text-progress-deep'
                : locked
                  ? 'bg-cloud text-graphite'
                  : 'bg-primary-soft text-primary-deep'
            }
          >
            {statusLabel}
          </Badge>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: data.typeColor }} />
        <span>{data.typeName}</span>
        {data.resourceCount ? (
          <Badge
            variant="link"
            className="nodrag ml-auto h-auto min-h-5 text-right whitespace-normal"
          >
            <Paperclip data-icon="inline-start" aria-hidden="true" />
            <span className="sr-only">Ver </span>
            {data.resourceCount} {data.resourceCount === 1 ? 'recurso' : 'recursos'}
          </Badge>
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
            background: 'var(--primary)',
            border: '2px solid var(--card)',
            visibility: editing ? 'visible' : 'hidden',
          }}
        />
      ))}
    </div>
  );
}

const nodeTypes = { roadmap: RoadmapCard };
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

export function mapRoadmapGraph(roadmap: RoadmapDto, canEdit: boolean) {
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: Node<CanvasNodeData>[] = roadmap.nodes.map((node) => ({
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
  const edges: Edge[] = roadmap.dependencies.map((dependency) => {
    const isSourceCompleted = nodesById.get(dependency.sourceNodeId)?.isCompleted;
    const stroke = isSourceCompleted ? 'var(--ink)' : 'var(--steel)';
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
      <Background color="var(--fog)" gap={20} size={1} />
    </ReactFlow>
  );
}
