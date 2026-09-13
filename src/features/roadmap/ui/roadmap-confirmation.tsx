import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  TeacherBlockImpact,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

type NodeTypePresentation = {
  name: string;
  icon: string;
  color: string;
};

type DependencyPresentation = {
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
  dependencies: DependencyPresentation[];
  resources: NodeDeletionResource[];
};

type NodeVisibilityConfirmationInput = {
  nodeId: string;
  node: {
    title: string;
    nodeType: NodeTypePresentation;
  };
  /** Whether the current operation hides the Node; false means publishing it. */
  isVisible: boolean;
  dependencies: DependencyPresentation[];
};

type RoadmapConfirmationRoadmap = {
  nodes: readonly RoadmapNodeIdentity[];
  nodeTypes: RoadmapDto['nodeTypes'];
};

type StructuralDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

type RoadmapNodeIdentity = {
  id: string;
  title: string;
  nodeTypeId: string;
};

export const roadmapConfirmationActionIds = {
  autoLayout: 'auto-layout',
  toggleVisibility: 'toggle-visibility',
  deleteNode: 'delete-node',
  deleteResource: 'delete-resource',
  deleteNodeType: 'delete-node-type',
  createDependency: 'create-dependency',
  blockTeacher: 'block-teacher',
  unlockNode: 'unlock-node',
  unlockBranch: 'unlock-branch',
  unlockPrerequisites: 'unlock-prerequisites',
} as const;

export const roadmapAutoLayoutConfirmation = {
  title: 'Confirmar ordenamiento',
  description: 'El ordenamiento automático reubicará los nodos del lienzo. ¿Deseas continuar?',
  intent: 'warning',
  actions: [{ id: roadmapConfirmationActionIds.autoLayout, label: 'Ordenar nodos' }],
} as const satisfies ConfirmationPresentation;

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

function nodeItem(
  nodeId: string,
  node: { title: string; nodeType: NodeTypePresentation },
  description?: string,
) {
  return {
    kind: 'item' as const,
    id: nodeId,
    title: node.title,
    description,
    media: nodeTypeMedia(node.nodeType),
    badge: node.nodeType.name,
  };
}

function dependencyItems(dependencies: DependencyPresentation[]) {
  return dependencies.map((dependency) => ({
    kind: 'relationship' as const,
    id: dependency.id,
    source: dependency.sourceTitle,
    target: dependency.targetTitle,
  }));
}

function nodeTypeFor(
  roadmap: Pick<RoadmapDto, 'nodeTypes'>,
  nodeTypeId: string,
): NodeTypePresentation {
  return (
    roadmap.nodeTypes.find((candidate) => candidate.id === nodeTypeId) ?? {
      name: 'Tipo de nodo',
      icon: 'Shapes',
      color: 'currentColor',
    }
  );
}

function teacherBlockRelationLabel(relation: TeacherBlockImpact['relation']) {
  if (relation === 'SELECTED_NODE') return 'Nodo seleccionado';
  if (relation === 'PREREQUISITE') return 'Prerrequisito';
  if (relation === 'DEPENDENT') return 'Dependiente';
  return undefined;
}

function teacherBlockItems(
  roadmap: RoadmapConfirmationRoadmap,
  nodes: readonly TeacherBlockImpact[],
  selectedNodeId?: string,
) {
  return nodes.map((node) => {
    const roadmapNode = roadmap.nodes.find((candidate) => candidate.id === node.id);
    const nodeType = node.nodeType
      ? node.nodeType
      : roadmapNode
        ? nodeTypeFor(roadmap, roadmapNode.nodeTypeId)
        : nodeTypeFor(roadmap, '');

    return nodeItem(
      node.id,
      { title: node.title, nodeType },
      teacherBlockRelationLabel(node.relation) ??
        (node.id === selectedNodeId ? 'Nodo seleccionado' : undefined),
    );
  });
}

function countLabel(count: number) {
  return count === 1 ? 'nodo' : 'nodos';
}

type RoadmapDependencyConfirmationInput = {
  roadmap: RoadmapConfirmationRoadmap;
  sourceNodeId: string;
  targetNodeId: string;
  nodes: readonly TeacherBlockImpact[];
};

export function roadmapDependencyConfirmation({
  roadmap,
  sourceNodeId,
  targetNodeId,
  nodes,
}: RoadmapDependencyConfirmationInput): ConfirmationPresentation {
  const nodeTitles = new Map(roadmap.nodes.map((node) => [node.id, node.title]));
  const sourceTitle = nodeTitles.get(sourceNodeId) ?? sourceNodeId;
  const targetTitle = nodeTitles.get(targetNodeId) ?? targetNodeId;

  return {
    title: 'Confirmar bloqueo',
    description: `Esta dependencia bloqueará persistentemente ${nodes.length} ${countLabel(nodes.length)}. Se aplicará un Bloqueo docente y esta acción puede afectar el acceso y progreso estudiantil.`,
    intent: 'warning',
    sections: [
      {
        title: 'Dependencia que se creará',
        items: [
          {
            kind: 'relationship',
            id: `dependency:${sourceNodeId}:${targetNodeId}`,
            source: sourceTitle,
            target: targetTitle,
          },
        ],
      },
      {
        title: 'Nodos que se bloquearán',
        items: teacherBlockItems(roadmap, nodes),
        emptyMessage: 'No hay Nodos afectados.',
      },
    ],
    actions: [{ id: roadmapConfirmationActionIds.createDependency, label: 'Conectar y bloquear' }],
  };
}

type RoadmapTeacherBlockConfirmationInput = {
  roadmap: RoadmapConfirmationRoadmap;
  nodeId: string;
  preview: TeacherBlockPreview;
  individualPreview?: TeacherBlockPreview;
  branchPreview?: TeacherBlockPreview;
};

function teacherBlockSection(
  roadmap: RoadmapConfirmationRoadmap,
  title: string,
  preview: TeacherBlockPreview,
  nodeId: string,
) {
  return {
    title,
    items: teacherBlockItems(roadmap, preview.nodes, nodeId),
    emptyMessage: 'No hay Nodos afectados.',
  };
}

export function roadmapTeacherBlockConfirmation({
  roadmap,
  nodeId,
  preview,
  individualPreview,
  branchPreview,
}: RoadmapTeacherBlockConfirmationInput): ConfirmationPresentation {
  if (individualPreview?.mode === 'SINGLE' && branchPreview?.mode === 'BRANCH') {
    return {
      title: 'Confirmar desbloqueo',
      description:
        'Elige el alcance del desbloqueo. Ambas opciones pueden afectar el acceso y progreso estudiantil.',
      intent: 'warning',
      sections: [
        teacherBlockSection(roadmap, 'Solo este Nodo', individualPreview, nodeId),
        teacherBlockSection(roadmap, 'Este Nodo y su rama', branchPreview, nodeId),
      ],
      actions: [
        { id: roadmapConfirmationActionIds.unlockNode, label: 'Desbloquear este Nodo' },
        { id: roadmapConfirmationActionIds.unlockBranch, label: 'Desbloquear la rama' },
      ],
    };
  }

  const nodes = preview.nodes.length;
  const nodesLabel = countLabel(nodes);

  if (preview.mode === 'BLOCK') {
    return {
      title: 'Confirmar bloqueo de rama',
      description: `Bloquearás ${nodes} ${nodesLabel}. Esta acción puede afectar el acceso y progreso estudiantil.`,
      intent: 'warning',
      sections: [teacherBlockSection(roadmap, 'Nodos que se bloquearán', preview, nodeId)],
      actions: [{ id: roadmapConfirmationActionIds.blockTeacher, label: 'Bloquear rama' }],
    };
  }

  if (preview.mode === 'UPSTREAM') {
    return {
      title: 'Desbloquear prerrequisitos',
      description: `Desbloquearás ${nodes} ${nodesLabel}, incluidos los prerrequisitos bloqueados. Esta acción puede afectar el acceso y progreso estudiantil.`,
      intent: 'warning',
      sections: [teacherBlockSection(roadmap, 'Nodos que se desbloquearán', preview, nodeId)],
      actions: [
        {
          id: roadmapConfirmationActionIds.unlockPrerequisites,
          label: `Desbloquear ${nodes} ${nodesLabel}`,
        },
      ],
    };
  }

  if (preview.mode === 'SINGLE') {
    return {
      title: 'Confirmar desbloqueo',
      description: `Desbloquearás ${nodes} ${nodesLabel}. Esta acción puede afectar el acceso y progreso estudiantil.`,
      intent: 'warning',
      sections: [teacherBlockSection(roadmap, 'Nodos que se desbloquearán', preview, nodeId)],
      actions: [{ id: roadmapConfirmationActionIds.unlockNode, label: 'Desbloquear este Nodo' }],
    };
  }

  return {
    title: 'Confirmar desbloqueo de rama',
    description: `Desbloquearás ${nodes} ${nodesLabel} elegibles de la rama. Esta acción puede afectar el acceso y progreso estudiantil.`,
    intent: 'warning',
    sections: [teacherBlockSection(roadmap, 'Nodos que se desbloquearán', preview, nodeId)],
    actions: [{ id: roadmapConfirmationActionIds.unlockBranch, label: 'Desbloquear la rama' }],
  };
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
        items: [nodeItem(nodeId, node)],
      },
      {
        title: 'Dependencias relacionadas',
        items: dependencyItems(dependencies),
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

export function nodeVisibilityConfirmation({
  nodeId,
  node,
  isVisible,
  dependencies,
}: NodeVisibilityConfirmationInput): ConfirmationPresentation {
  const isHiding = isVisible;
  const dependencyCount = dependencies.length;

  return {
    title: isHiding ? 'Confirmar ocultación' : 'Confirmar publicación',
    description: isHiding ? (
      dependencyCount > 0 ? (
        <>
          El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo docente y se
          eliminarán{' '}
          <span className="font-semibold text-destructive">
            {dependencyCount}{' '}
            {dependencyCount === 1 ? 'dependencia relacionada' : 'dependencias relacionadas'}
          </span>
          .
        </>
      ) : (
        'El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo docente y no posee Dependencias.'
      )
    ) : (
      'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.'
    ),
    intent: isHiding ? 'destructive' : 'default',
    sections: [
      {
        title: isHiding ? 'Nodo que se ocultará' : 'Nodo que se publicará',
        items: [nodeItem(nodeId, node)],
      },
      ...(isHiding
        ? [
            {
              title: 'Dependencias que se eliminarán',
              items: dependencyItems(dependencies),
              emptyMessage: 'No hay Dependencias relacionadas.',
            },
          ]
        : []),
    ],
    actions: [
      {
        id: roadmapConfirmationActionIds.toggleVisibility,
        label: isHiding ? 'Ocultar' : 'Mostrar',
      },
    ],
  };
}

export function roadmapNodeDeletionConfirmation(
  roadmap: Pick<RoadmapDto, 'nodes' | 'dependencies' | 'nodeTypes'>,
  node: RoadmapNode,
): ConfirmationPresentation {
  const nodeTitles = new Map(roadmap.nodes.map((candidate) => [candidate.id, candidate.title]));

  return nodeDeletionConfirmation({
    nodeId: node.id,
    node: { title: node.title, nodeType: nodeTypeFor(roadmap, node.nodeTypeId) },
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

export function roadmapNodeVisibilityConfirmation(
  roadmap: { nodes: readonly RoadmapNodeIdentity[]; nodeTypes: RoadmapDto['nodeTypes'] },
  node: RoadmapNodeIdentity,
  isVisible: boolean,
  dependencies: readonly StructuralDependency[],
): ConfirmationPresentation {
  const nodeTitles = new Map(roadmap.nodes.map((candidate) => [candidate.id, candidate.title]));

  return nodeVisibilityConfirmation({
    nodeId: node.id,
    node: { title: node.title, nodeType: nodeTypeFor(roadmap, node.nodeTypeId) },
    isVisible,
    dependencies: dependencies.map((dependency) => ({
      id: dependency.id,
      sourceTitle: nodeTitles.get(dependency.sourceNodeId) ?? dependency.sourceNodeId,
      targetTitle: nodeTitles.get(dependency.targetNodeId) ?? dependency.targetNodeId,
    })),
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
