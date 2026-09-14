import { MarkerType } from '@xyflow/react';
import type { RoadmapNodeDto } from '@/features/roadmap/types';
import { studentNodeBlockReason, studentNodeStatus } from '@/features/roadmap/student/node-status';
import type { RoadmapFlowNode, RoadmapNodeStatus } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import type { NodeActionCallbacks } from '@/features/roadmap/graph/node-action';
import type { RoadmapGraphProjection } from '@/features/roadmap/graph/roadmap-graph-projection';

const studentEdgeStroke = 'var(--ink)';

function nodeStatus(node: RoadmapNodeDto, isTeacherView: boolean): RoadmapNodeStatus {
  if (isTeacherView) return 'editing';
  return studentNodeStatus(node);
}

export function mapRoadmapGraph(
  projection: RoadmapGraphProjection,
  onDeleteDependency?: (dependencyId: string) => void,
  selectedNodeId?: string | null,
  actionMenu?: NodeActionCallbacks & {
    openNodeId: string | null;
    closingNodeId: string | null;
    onToggle: (nodeId: string, trigger: HTMLButtonElement) => void;
  },
) {
  const { roadmap } = projection;
  const isTeacherView = projection.kind === 'teaching';
  const canEdit = isTeacherView && Boolean(projection.editing);
  const nodeTypesById = new Map(roadmap.nodeTypes.map((type) => [type.id, type]));
  const nodesById = new Map(roadmap.nodes.map((node) => [node.id, node]));
  const nodes: RoadmapFlowNode[] = roadmap.nodes.map((node) => {
    const isHidden = 'isVisible' in node && !node.isVisible;
    const blockReason = isTeacherView ? undefined : studentNodeBlockReason(node);
    const resources = 'resources' in node ? node.resources : [];
    return {
      id: node.id,
      type: 'roadmap',
      data: {
        title: node.title,
        typeColor: nodeTypesById.get(node.nodeTypeId)?.color ?? 'var(--primary)',
        typeName: nodeTypesById.get(node.nodeTypeId)?.name ?? 'Sin tipo',
        typeIcon: nodeTypesById.get(node.nodeTypeId)?.icon ?? 'Shapes',
        status: nodeStatus(node, isTeacherView),
        isHidden,
        isTeacherBlocked: isTeacherView && 'isTeacherBlocked' in node && node.isTeacherBlocked,
        fileCount: resources.filter((resource) => resource.type === 'FILE').length,
        linkCount: resources.filter((resource) => resource.type !== 'FILE').length,
        blockReason,
        canManageActions: canEdit,
        isActionMenuOpen:
          actionMenu?.openNodeId === node.id || actionMenu?.closingNodeId === node.id,
        isActionMenuClosing: actionMenu?.closingNodeId === node.id,
        onToggleActionMenu: actionMenu?.onToggle,
        onRequestAccessAction: actionMenu?.onRequestAccessAction,
        onRequestVisibilityAction: actionMenu?.onRequestVisibilityAction,
        onRequestAddResource: actionMenu?.onRequestAddResource,
        onRequestDelete: actionMenu?.onRequestDelete,
      },
      position: { x: node.positionX, y: node.positionY },
      selected: node.id === selectedNodeId,
      hidden: !isTeacherView && isHidden,
      connectable: canEdit && !isHidden,
      deletable: false,
      selectable: canEdit || !blockReason,
      focusable: true,
      zIndex: actionMenu?.openNodeId === node.id || actionMenu?.closingNodeId === node.id ? 20 : 0,
      ariaRole: blockReason ? 'button' : undefined,
      domAttributes: blockReason ? { 'aria-disabled': true } : undefined,
    };
  });
  const edges: RoadmapFlowEdge[] = roadmap.dependencies.map((dependency) => {
    const defaultStroke = isTeacherView
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
