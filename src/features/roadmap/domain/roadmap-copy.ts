import type { Resource } from '../types';

/** Case- and whitespace-insensitive identity of a Node type name. */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

/**
 * Maps a frozen version's content onto a new Roadmap. Visible Nodes start
 * Teacher-blocked, hidden Nodes stay hidden and unblocked, Scheduled unlocks are
 * dropped, Custom node types are copied and Predefined node types stay shared.
 * File Resources are not copied yet.
 */

export type RoadmapCopySource = Readonly<{
  customNodeTypes: readonly { id: string; name: string; icon: string; color: string }[];
  nodes: readonly {
    id: string;
    nodeTypeId: string;
    title: string;
    description: string | null;
    positionX: number;
    positionY: number;
    isVisible: boolean;
  }[];
  dependencies: readonly {
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string;
    targetHandle: string;
  }[];
  resources: readonly {
    roadmapNodeId: string;
    title: string;
    url: string;
    type: Resource['type'];
  }[];
}>;

export function planRoadmapCopy(source: RoadmapCopySource, roadmapId: string, newId: () => string) {
  const remap = (ids: readonly { id: string }[]) => new Map(ids.map(({ id }) => [id, newId()]));
  const typeIds = remap(source.customNodeTypes);
  const nodeIds = remap(source.nodes);
  const nodeId = (id: string) => {
    const copied = nodeIds.get(id);
    if (!copied) throw new Error(`Node ${id} is not part of the copied Roadmap.`);
    return copied;
  };

  return {
    nodeTypes: source.customNodeTypes.map(({ id, name, icon, color }) => ({
      id: typeIds.get(id)!,
      roadmapId,
      name,
      normalizedName: normalizeName(name),
      icon,
      color,
    })),
    nodes: source.nodes.map((node) => ({
      id: nodeId(node.id),
      roadmapId,
      nodeTypeId: typeIds.get(node.nodeTypeId) ?? node.nodeTypeId,
      title: node.title,
      description: node.description,
      positionX: node.positionX,
      positionY: node.positionY,
      isVisible: node.isVisible,
      isTeacherBlocked: node.isVisible,
      teacherUnlockOn: null,
    })),
    dependencies: source.dependencies.map((dependency) => ({
      id: newId(),
      sourceNodeId: nodeId(dependency.sourceNodeId),
      targetNodeId: nodeId(dependency.targetNodeId),
      sourceHandle: dependency.sourceHandle,
      targetHandle: dependency.targetHandle,
    })),
    resources: source.resources
      .filter(({ type }) => type !== 'FILE')
      .map((resource) => ({
        id: newId(),
        roadmapNodeId: nodeId(resource.roadmapNodeId),
        title: resource.title,
        url: resource.url,
        type: resource.type,
      })),
  };
}
