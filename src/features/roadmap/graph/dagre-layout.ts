import dagre from '@dagrejs/dagre';
import { Position } from '@xyflow/react';
import { roadmapNodeSize, snapToRoadmapGrid } from '@/lib/roadmap-geometry';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';

export type RoadmapLayoutDirection = 'TB' | 'LR';

/**
 * Ordena las dependencias de arriba abajo. Dagre trabaja con centros; React Flow,
 * con la esquina superior izquierda, por lo que se corrige el ancla al final.
 */
export function layoutRoadmapGraph(
  nodes: RoadmapFlowNode[],
  edges: RoadmapFlowEdge[],
  direction: RoadmapLayoutDirection = 'TB',
): RoadmapFlowNode[] {
  if (nodes.length === 0) return nodes;

  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  const nodeIds = new Set(nodes.map((node) => node.id));
  nodes.forEach((node) => {
    graph.setNode(node.id, { ...roadmapNodeSize });
  });
  edges.forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target))
      graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const dimensions = graph.node(node.id);
    return {
      ...node,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      position: snapToRoadmapGrid({
        x: dimensions.x - roadmapNodeSize.width / 2,
        y: dimensions.y - roadmapNodeSize.height / 2,
      }),
    };
  });
}
