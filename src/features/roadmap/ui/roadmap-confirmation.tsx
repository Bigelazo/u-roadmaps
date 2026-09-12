import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type { Resource, RoadmapDto, RoadmapNode } from '@/features/roadmap/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

type NodeTypePresentation = {
  name: string;
  icon: string;
  color: string;
};

type NodeDeletionDependency = {
  id: string;
  sourceTitle: string;
  targetTitle: string;
};

type NodeDeletionResource = Pick<Resource, 'id' | 'title'> & {
  type?: Resource['type'];
};

type NodeDeletionConfirmationInput = {
  nodeId: string;
  node: {
    title: string;
    nodeType: NodeTypePresentation;
  };
  dependencies: NodeDeletionDependency[];
  resources: NodeDeletionResource[];
};

export const roadmapConfirmationActionIds = {
  deleteNode: 'delete-node',
  deleteResource: 'delete-resource',
  deleteNodeType: 'delete-node-type',
} as const;

function nodeTypeMedia(nodeType: NodeTypePresentation) {
  return (
    <NodeTypeIcon
      icon={nodeType.icon}
      className="size-4"
      style={{ color: nodeType.color }}
      aria-label={nodeType.name}
    />
  );
}

function resourceTypeLabel(type: Resource['type'] | undefined) {
  if (type === 'FILE') return 'Archivo';
  if (type === 'VIDEO') return 'Video';
  return 'Enlace';
}

export function nodeDeletionConfirmation({
  nodeId,
  node,
  dependencies,
  resources,
}: NodeDeletionConfirmationInput): ConfirmationPresentation {
  return {
    title: 'Eliminar Nodo',
    description: `Eliminarás ${node.title} y sus elementos relacionados. Esta acción no se puede deshacer.`,
    intent: 'destructive',
    sections: [
      {
        title: 'Nodo que se eliminará',
        items: [
          {
            kind: 'item',
            id: nodeId,
            title: node.title,
            media: nodeTypeMedia(node.nodeType),
            badge: node.nodeType.name,
          },
        ],
      },
      {
        title: 'Dependencias relacionadas',
        items: dependencies.map((dependency) => ({
          kind: 'relationship' as const,
          id: dependency.id,
          source: dependency.sourceTitle,
          target: dependency.targetTitle,
        })),
        emptyMessage: 'No hay Dependencias relacionadas.',
      },
      {
        title: 'Recursos que se eliminarán',
        items: resources.map((resource) => ({
          kind: 'item' as const,
          id: resource.id,
          title: resource.title,
          description: resource.type ? resourceTypeLabel(resource.type) : undefined,
        })),
        emptyMessage: 'No hay Recursos relacionados.',
      },
    ],
    actions: [{ id: roadmapConfirmationActionIds.deleteNode, label: 'Eliminar Nodo' }],
  };
}

export function roadmapNodeDeletionConfirmation(
  roadmap: Pick<RoadmapDto, 'nodes' | 'dependencies' | 'nodeTypes'>,
  node: RoadmapNode,
): ConfirmationPresentation {
  const nodeTitles = new Map(roadmap.nodes.map((candidate) => [candidate.id, candidate.title]));
  const nodeType = roadmap.nodeTypes.find((candidate) => candidate.id === node.nodeTypeId) ?? {
    name: 'Tipo de nodo',
    icon: 'Shapes',
    color: 'currentColor',
  };

  return nodeDeletionConfirmation({
    nodeId: node.id,
    node: { title: node.title, nodeType },
    dependencies: roadmap.dependencies
      .filter(
        (dependency) => dependency.sourceNodeId === node.id || dependency.targetNodeId === node.id,
      )
      .map((dependency) => ({
        id: dependency.id,
        sourceTitle: nodeTitles.get(dependency.sourceNodeId) ?? dependency.sourceNodeId,
        targetTitle: nodeTitles.get(dependency.targetNodeId) ?? dependency.targetNodeId,
      })),
    resources: node.resources,
  });
}

export function resourceDeletionConfirmation(resource: Resource): ConfirmationPresentation {
  return {
    title: 'Confirmar eliminación',
    description: `Eliminarás el recurso ${resource.title}. Esta acción no se puede deshacer.`,
    intent: 'destructive',
    sections: [
      {
        title: 'Recurso que se eliminará',
        items: [
          {
            kind: 'item',
            id: resource.id,
            title: resource.title,
            description: resourceTypeLabel(resource.type),
          },
        ],
      },
    ],
    actions: [{ id: roadmapConfirmationActionIds.deleteResource, label: 'Eliminar' }],
  };
}

export function nodeTypeDeletionConfirmation(
  nodeType: NodeTypePresentation & { id: string },
): ConfirmationPresentation {
  return {
    title: 'Confirmar eliminación',
    description: `Eliminarás el Tipo de nodo ${nodeType.name}. Esta acción no se puede deshacer.`,
    intent: 'destructive',
    sections: [
      {
        title: 'Tipo de nodo que se eliminará',
        items: [
          {
            kind: 'item',
            id: nodeType.id,
            title: nodeType.name,
            media: nodeTypeMedia(nodeType),
            badge: 'Personalizado',
          },
        ],
      },
    ],
    actions: [{ id: roadmapConfirmationActionIds.deleteNodeType, label: 'Eliminar' }],
  };
}
