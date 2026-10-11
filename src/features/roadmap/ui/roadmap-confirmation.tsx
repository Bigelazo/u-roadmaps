import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import type {
  Resource,
  RoadmapDto,
  TeacherBlockImpact,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

type NodeTypePresentation = {
  name: string;
  icon: string;
  color: string;
};

function nodeVisibilityDescription(isHiding: boolean, dependencyCount: number) {
  if (!isHiding)
    return 'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.';
  if (dependencyCount === 0)
    return 'El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo docente y no posee Dependencias.';

  const dependencyLabel =
    dependencyCount === 1 ? 'dependencia relacionada' : 'dependencias relacionadas';
  return `El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo docente y se eliminarán ${dependencyCount} ${dependencyLabel}.`;
}

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
  deleteDependencies: 'delete-dependencies',
  blockTeacher: 'block-teacher',
  unlockNode: 'unlock-node',
  unlockBranch: 'unlock-branch',
  unlockPrerequisites: 'unlock-prerequisites',
  discardEditorDraft: 'discard-draft',
} as const;

export const roadmapAutoLayoutConfirmation = {
  title: 'Confirmar ordenamiento',
  description: 'El ordenamiento automático reubicará los nodos del lienzo. ¿Deseas continuar?',
  intent: 'warning',
  actions: [{ id: roadmapConfirmationActionIds.autoLayout, label: 'Ordenar nodos' }],
} as const satisfies ConfirmationPresentation;

const editorDraftDiscardDescriptions: Record<NodeEditorGuardReason['kind'], string> = {
  'replace-node':
    'Seleccionar otro Nodo descartará el borrador actual. Puedes seguir editando o descartarlo para continuar.',
  'open-resource':
    'Agregar un recurso a otro nodo reemplazará el borrador actual. Puedes seguir editando o descartarlo para continuar.',
  'deselect-node':
    'Cerrar este Nodo descartará el borrador actual. Puedes seguir editando o descartarlo para continuar.',
  'delete-node':
    'Eliminar este Nodo descartará el borrador actual. Puedes seguir editando o descartarlo para continuar.',
  'enter-canvas-preview':
    'La previsualización muestra únicamente el último estado guardado. Puedes seguir editando o descartar este borrador para continuar.',
};

export function editorDraftDiscardConfirmation(
  destination: NodeEditorGuardReason,
): ConfirmationPresentation {
  return {
    title: 'Descartar cambios sin guardar',
    description: editorDraftDiscardDescriptions[destination.kind],
    intent: 'warning',
    cancelLabel: 'Seguir editando',
    actions: [
      {
        id: roadmapConfirmationActionIds.discardEditorDraft,
        label:
          destination.kind === 'enter-canvas-preview'
            ? 'Descartar y previsualizar'
            : 'Descartar y continuar',
      },
    ],
  };
}

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

function nodeTitleLookup(roadmap: RoadmapConfirmationRoadmap) {
  const nodeTitles = new Map(roadmap.nodes.map((node) => [node.id, node.title]));
  return (nodeId: string) => nodeTitles.get(nodeId) ?? nodeId;
}

const teacherBlockEmptyMessage = 'No hay Nodos afectados.';

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
  const titleOf = nodeTitleLookup(roadmap);

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
            source: titleOf(sourceNodeId),
            target: titleOf(targetNodeId),
          },
        ],
      },
      {
        title: 'Nodos que se bloquearán',
        items: teacherBlockItems(roadmap, nodes),
        emptyMessage: teacherBlockEmptyMessage,
      },
    ],
    actions: [{ id: roadmapConfirmationActionIds.createDependency, label: 'Conectar y bloquear' }],
  };
}

export function roadmapDependencyDeletionConfirmation(
  dependencyIds: readonly string[],
): ConfirmationPresentation {
  const dependencyLabel = dependencyIds.length === 1 ? 'esta dependencia' : 'estas dependencias';

  return {
    title: 'Confirmar eliminación',
    description: `Eliminarás ${dependencyLabel}. Esta acción no se puede deshacer.`,
    intent: 'destructive',
    actions: [{ id: roadmapConfirmationActionIds.deleteDependencies, label: 'Eliminar' }],
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
    emptyMessage: teacherBlockEmptyMessage,
  };
}

const teacherBlockModes: Record<
  TeacherBlockPreview['mode'],
  {
    title: string;
    description: (nodeCount: string) => string;
    sectionTitle: string;
    actionId: string;
    /** Omitted when the label names the affected Node count. */
    actionLabel?: string;
  }
> = {
  BLOCK: {
    title: 'Confirmar bloqueo de rama',
    description: (nodeCount) =>
      `Bloquearás ${nodeCount}. Esta acción puede afectar el acceso y progreso estudiantil.`,
    sectionTitle: 'Nodos que se bloquearán',
    actionId: roadmapConfirmationActionIds.blockTeacher,
    actionLabel: 'Bloquear rama',
  },
  UPSTREAM: {
    title: 'Desbloquear prerrequisitos',
    description: (nodeCount) =>
      `Desbloquearás ${nodeCount}, incluidos los prerrequisitos bloqueados. Esta acción puede afectar el acceso y progreso estudiantil.`,
    sectionTitle: 'Nodos que se desbloquearán',
    actionId: roadmapConfirmationActionIds.unlockPrerequisites,
  },
  SINGLE: {
    title: 'Confirmar desbloqueo',
    description: (nodeCount) =>
      `Desbloquearás ${nodeCount}. Esta acción puede afectar el acceso y progreso estudiantil.`,
    sectionTitle: 'Nodos que se desbloquearán',
    actionId: roadmapConfirmationActionIds.unlockNode,
    actionLabel: 'Desbloquear este Nodo',
  },
  BRANCH: {
    title: 'Confirmar desbloqueo de rama',
    description: (nodeCount) =>
      `Desbloquearás ${nodeCount} elegibles de la rama. Esta acción puede afectar el acceso y progreso estudiantil.`,
    sectionTitle: 'Nodos que se desbloquearán',
    actionId: roadmapConfirmationActionIds.unlockBranch,
    actionLabel: 'Desbloquear la rama',
  },
};

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
  const mode = teacherBlockModes[preview.mode];

  return {
    title: mode.title,
    description: mode.description(`${nodes} ${nodesLabel}`),
    intent: 'warning',
    sections: [teacherBlockSection(roadmap, mode.sectionTitle, preview, nodeId)],
    actions: [
      { id: mode.actionId, label: mode.actionLabel ?? `Desbloquear ${nodes} ${nodesLabel}` },
    ],
  };
}

export function nodeDeletionConfirmation({
  node,
}: {
  node: { title: string; nodeType: NodeTypePresentation };
}): ConfirmationPresentation {
  return {
    title: (
      <span className="wrap-break-word">
        Eliminar nodo:{' '}
        <NodeTypeIcon
          icon={node.nodeType.icon}
          style={{ color: node.nodeType.color }}
          aria-hidden="true"
          className="inline-block size-5 align-text-bottom"
        />{' '}
        {node.title}
      </span>
    ),
    description:
      'Eliminarás este nodo, junto con todos sus recursos y dependencias relacionadas. Esta acción no se puede deshacer.',
    intent: 'destructive',
    actions: [{ id: roadmapConfirmationActionIds.deleteNode, label: 'Eliminar' }],
  };
}

export function roadmapNodeVisibilityConfirmation(
  roadmap: RoadmapConfirmationRoadmap,
  node: RoadmapNodeIdentity,
  /** Whether the current operation hides the Node; false means publishing it. */
  isHiding: boolean,
  dependencies: readonly StructuralDependency[],
): ConfirmationPresentation {
  const titleOf = nodeTitleLookup(roadmap);

  return {
    title: isHiding ? 'Confirmar ocultación' : 'Confirmar publicación',
    description: nodeVisibilityDescription(isHiding, dependencies.length),
    intent: isHiding ? 'destructive' : 'default',
    sections: [
      {
        title: isHiding ? 'Nodo que se ocultará' : 'Nodo que se publicará',
        items: [
          nodeItem(node.id, { title: node.title, nodeType: nodeTypeFor(roadmap, node.nodeTypeId) }),
        ],
      },
      ...(isHiding
        ? [
            {
              title: 'Dependencias que se eliminarán',
              items: dependencies.map((dependency) => ({
                kind: 'relationship' as const,
                id: dependency.id,
                source: titleOf(dependency.sourceNodeId),
                target: titleOf(dependency.targetNodeId),
              })),
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
