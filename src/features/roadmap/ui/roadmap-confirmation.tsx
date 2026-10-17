import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
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

function quoted(title: string) {
  return `“${title}”`;
}

/** Names up to three Nodes in prose; longer lists collapse to a count. */
function nodeNames(titles: readonly string[]) {
  if (titles.length > 3) return `${titles.length} nodos`;
  const names = titles.map(quoted);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
}

function uniqueTitles(titles: readonly string[]) {
  return [...new Set(titles)];
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
  isTeacherBlocked?: boolean;
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
    intent: 'destructive',
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
  return roadmap.nodeTypes.find((candidate) => candidate.id === nodeTypeId) ?? unknownNodeType;
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

function affectedTitles(
  preview: TeacherBlockPreview,
  nodeId: string,
  relation?: TeacherBlockImpact['relation'],
) {
  return uniqueTitles(
    preview.nodes
      .filter(
        (node) =>
          node.id !== nodeId &&
          node.relation !== 'SELECTED_NODE' &&
          (!relation || node.relation === relation),
      )
      .map((node) => node.title),
  );
}

/** Describes the dependents an access change carries along, naming them when they are few. */
function dependentsPhrase(titles: readonly string[], state: { one: string; many: string }) {
  if (titles.length > 3) return `Los ${nodeNames(titles)} que dependen de él ${state.many}`;
  return titles.length === 1
    ? `${nodeNames(titles)}, que depende de él, ${state.one}`
    : `${nodeNames(titles)}, que dependen de él, ${state.many}`;
}

function withDependents(
  sentence: string,
  dependents: readonly string[],
  state: { one: string; many: string },
) {
  return dependents.length ? `${sentence} ${dependentsPhrase(dependents, state)}.` : sentence;
}

export function roadmapTeacherBlockConfirmation({
  roadmap,
  nodeId,
  preview,
  individualPreview,
  branchPreview,
}: RoadmapTeacherBlockConfirmationInput): ConfirmationPresentation {
  const title = quoted(nodeTitleLookup(roadmap)(nodeId));

  if (individualPreview?.mode === 'SINGLE' && branchPreview?.mode === 'BRANCH') {
    const dependents = affectedTitles(branchPreview, nodeId);
    return {
      title: `¿Desbloquear ${title}?`,
      description: `Los estudiantes podrán abrirlo cuando completen sus prerrequisitos.${
        dependents.length
          ? ` ${dependentsPhrase(dependents, { one: 'sigue bloqueado', many: 'siguen bloqueados' })}: puedes desbloquear solo este nodo o también sus dependientes.`
          : ''
      }`,
      intent: 'warning',
      actions: [
        { id: roadmapConfirmationActionIds.unlockNode, label: 'Solo este nodo' },
        { id: roadmapConfirmationActionIds.unlockBranch, label: 'Incluir dependientes' },
      ],
    };
  }

  if (preview.mode === 'BLOCK') {
    const selectedNode = roadmap.nodes.find((node) => node.id === nodeId);
    const inlineNode = (node: TeacherBlockImpact) => {
      const roadmapNode = roadmap.nodes.find((candidate) => candidate.id === node.id);
      const nodeType = node.nodeType ?? nodeTypeFor(roadmap, roadmapNode?.nodeTypeId ?? '');
      return (
        <span key={node.id}>
          <NodeTypeIcon
            icon={nodeType.icon}
            className="inline size-[1em] align-[-0.125em]"
            style={{ color: nodeType.color }}
            aria-hidden="true"
          />{' '}
          {quoted(node.title)}
        </span>
      );
    };
    const dependents = preview.nodes.filter(
      (node) => node.id !== nodeId && node.relation !== 'SELECTED_NODE',
    );
    const selected = preview.nodes.find((node) => node.id === nodeId) ?? {
      id: nodeId,
      title: selectedNode?.title ?? nodeId,
      relation: 'SELECTED_NODE' as const,
    };
    return {
      title: <>¿Bloquear {inlineNode(selected)}?</>,
      description: (
        <>
          Los estudiantes no podrán acceder a él hasta su desbloqueo.
          {dependents.length > 0 ? (
            <>
              {' '}
              {dependents.length === 1 ? 'El nodo ' : 'Los nodos '}
              {dependents.map((node, index) => (
                <span key={node.id}>
                  {index > 0 ? (index === dependents.length - 1 ? ' y ' : ', ') : null}
                  {inlineNode(node)}
                </span>
              ))}
              {dependents.length === 1 ? ' también será bloqueado.' : ' también serán bloqueados.'}
            </>
          ) : null}
        </>
      ),
      intent: 'warning',
      actions: [{ id: roadmapConfirmationActionIds.blockTeacher, label: 'Bloquear nodo' }],
    };
  }

  if (preview.mode === 'UPSTREAM') {
    const prerequisites = affectedTitles(preview, nodeId, 'PREREQUISITE');
    const nodes = preview.nodes.length;
    return {
      title: `¿Desbloquear ${title}?`,
      description: `Para que los estudiantes puedan abrirlo, también se desbloquearán sus prerrequisitos bloqueados: ${nodeNames(
        prerequisites,
      )}.`,
      intent: 'warning',
      actions: [
        {
          id: roadmapConfirmationActionIds.unlockPrerequisites,
          label: `Desbloquear ${nodes} ${countLabel(nodes)}`,
        },
      ],
    };
  }

  return {
    title: `¿Desbloquear ${title}?`,
    description: withDependents(
      'Los estudiantes podrán abrirlo cuando completen sus prerrequisitos.',
      affectedTitles(preview, nodeId),
      { one: 'también quedará desbloqueado', many: 'también quedarán desbloqueados' },
    ),
    intent: 'warning',
    actions: [
      {
        id:
          preview.mode === 'BRANCH'
            ? roadmapConfirmationActionIds.unlockBranch
            : roadmapConfirmationActionIds.unlockNode,
        label: 'Desbloquear nodo',
      },
    ],
  };
}

export function nodeDeletionConfirmation({
  node,
  resources,
  dependencies,
}: {
  node: { title: string; nodeType: NodeTypePresentation };
  resources: readonly { id: string }[];
  dependencies: readonly { sourceTitle: string; targetTitle: string }[];
}): ConfirmationPresentation {
  const connected = uniqueTitles(
    dependencies.map((dependency) =>
      dependency.sourceTitle === node.title ? dependency.targetTitle : dependency.sourceTitle,
    ),
  );
  const losses = [
    resources.length === 1
      ? 'su recurso'
      : resources.length > 1
        ? `sus ${resources.length} recursos`
        : '',
    connected.length ? `sus conexiones con ${nodeNames(connected)}` : '',
  ].filter(Boolean);

  return {
    title: <span className="wrap-break-word">¿Eliminar {quoted(node.title)}?</span>,
    description: `${
      losses.length ? `También se eliminarán ${losses.join(' y ')}. ` : ''
    }Esta acción no se puede deshacer.`,
    intent: 'destructive',
    actions: [{ id: roadmapConfirmationActionIds.deleteNode, label: 'Eliminar nodo' }],
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
  const title = quoted(node.title);

  if (!isHiding) {
    return {
      title: `¿Mostrar ${title}?`,
      description:
        'Los estudiantes podrán verlo y abrirlo de inmediato. Aparecerá sin conexiones ni bloqueo docente.',
      intent: 'default',
      actions: [{ id: roadmapConfirmationActionIds.toggleVisibility, label: 'Mostrar' }],
    };
  }

  const connected = uniqueTitles(
    dependencies.map((dependency) =>
      titleOf(
        dependency.sourceNodeId === node.id ? dependency.targetNodeId : dependency.sourceNodeId,
      ),
    ),
  );
  const losses = [
    node.isTeacherBlocked ? 'se quitará su bloqueo docente' : '',
    connected.length ? `se eliminarán sus conexiones con ${nodeNames(connected)}` : '',
  ].filter(Boolean);
  const consequences = losses.length
    ? ` Además, ${losses.join(' y ')}${
        connected.length ? '; al volver a mostrarlo, tendrás que conectarlo de nuevo' : ''
      }.`
    : '';

  return {
    title: `¿Ocultar ${title}?`,
    description: `Dejará de aparecer en el roadmap de los estudiantes.${consequences}`,
    intent: 'destructive',
    actions: [{ id: roadmapConfirmationActionIds.toggleVisibility, label: 'Ocultar' }],
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
