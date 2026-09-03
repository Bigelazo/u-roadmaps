import { MarkerType } from '@xyflow/react';
import type { AnyRoadmapDto, RoadmapNodeDto } from '@/features/roadmap/types';
import { studentNodeBlockReason, studentNodeStatus } from '@/features/roadmap/student/node-status';
import type { RoadmapFlowNode, RoadmapNodeStatus } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';

const studentEdgeStroke = 'var(--ink)';

function nodeStatus(node: RoadmapNodeDto, canEdit: boolean): RoadmapNodeStatus {
  if (canEdit) return 'editing';
  return studentNodeStatus(node);
}

export function mapRoadmapGraph(
  roadmap: AnyRoadmapDto,
  canEdit: boolean,
  onDeleteDependency?: (dependencyId: string) => void,
) {
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: RoadmapFlowNode[] = roadmap.nodes.map((node) => {
    const isHidden = 'isVisible' in node && !node.isVisible;
    const blockReason = canEdit ? undefined : studentNodeBlockReason(node);
    return {
      id: node.id,
      type: 'roadmap',
      data: {
        title: node.title,
        typeColor: nodeTypesById.get(node.nodeTypeId)?.color ?? 'var(--primary)',
        typeName: nodeTypesById.get(node.nodeTypeId)?.name ?? 'Sin tipo',
        status: nodeStatus(node, canEdit),
        isHidden,
        blockReason,
      },
      position: { x: node.positionX, y: node.positionY },
      hidden: !canEdit && isHidden,
      connectable: canEdit && !isHidden,
      deletable: false,
      selectable: canEdit || !blockReason,
      focusable: true,
      ariaRole: blockReason ? 'button' : undefined,
      domAttributes: blockReason ? { 'aria-disabled': true } : undefined,
    };
  });
  const edges: RoadmapFlowEdge[] = roadmap.dependencies.map((dependency) => {
    const defaultStroke = canEdit
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
