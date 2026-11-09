import type { ReactNode } from 'react';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import type {
  Resource,
  RoadmapDto,
  TeacherBlockImpact,
  TeacherBlockOperationImpact,
} from '@/features/roadmap/types';
import type { NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import { NodeName } from '@/features/roadmap/ui/NodeName';
import {
  scheduledUnlockPrerequisiteHint,
  UnlockScheduleField,
  type UnlockScheduleDraft,
} from '@/features/roadmap/ui/UnlockScheduleField';
import type { ConfirmationAction, ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

export const canvasConfirmationChoices = {
  autoLayoutVertical: 'auto-layout-vertical',
  autoLayoutHorizontal: 'auto-layout-horizontal',
  hideNode: 'hide-node',
  showNode: 'show-node',
  deleteNode: 'delete-node',
  deleteNodeType: 'delete-node-type',
  resetCanvasPreview: 'reset-canvas-preview',
  createDependency: 'create-dependency',
  deleteDependencies: 'delete-dependencies',
  blockTeacher: 'block-teacher',
  unlockNode: 'unlock-node',
  unlockBranch: 'unlock-branch',
  unlockPrerequisites: 'unlock-prerequisites',
} as const;

export type CanvasConfirmationChoice =
  (typeof canvasConfirmationChoices)[keyof typeof canvasConfirmationChoices];

export type { UnlockScheduleDraft };

type NodeTypePresentation = {
  name: string;
  icon: string;
  color: string;
};

export type RoadmapConfirmationRoadmap = {
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

type UnlockActions = [ConfirmationAction] | [ConfirmationAction, ConfirmationAction];

function Emphasis({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

function nodeCount(count: number) {
  return count === 1 ? '1 nodo' : `${count} nodos`;
}

function sentenceList(parts: readonly string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0];
}

function nodeTypeFor(
  roadmap: Pick<RoadmapDto, 'nodeTypes'>,
  nodeTypeId: string,
): NodeTypePresentation {
  return roadmap.nodeTypes.find((candidate) => candidate.id === nodeTypeId) ?? unknownNodeType;
}

function roadmapNodeName(
  roadmap: RoadmapConfirmationRoadmap,
  nodeId: string,
  known?: Pick<TeacherBlockImpact, 'title' | 'nodeType'>,
) {
  const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
  const nodeType = known?.nodeType ?? nodeTypeFor(roadmap, node?.nodeTypeId ?? '');
  return <NodeName title={known?.title ?? node?.title ?? nodeId} nodeType={nodeType} />;
}

export const roadmapAutoLayoutConfirmation = {
  title: '¿Ordenar los nodos automáticamente?',
  description:
    'Selecciona la distribución para ordenar. Todos los nodos del roadmap cambiarán de posición.',
  intent: 'warning',
  actions: [
    { id: canvasConfirmationChoices.autoLayoutVertical, label: 'Vertical', emphasis: 'primary' },
    {
      id: canvasConfirmationChoices.autoLayoutHorizontal,
      label: 'Horizontal',
      emphasis: 'primary',
    },
  ],
} as const satisfies ConfirmationPresentation;

export const canvasPreviewResetConfirmation = {
  title: '¿Reiniciar el progreso simulado?',
  description: 'Se reiniciarán los nodos completados en esta previsualización.',
  intent: 'warning',
  actions: [{ id: canvasConfirmationChoices.resetCanvasPreview, label: 'Reiniciar progreso' }],
} as const satisfies ConfirmationPresentation;

export const nodeEditorConfirmationActionIds = {
  deleteResource: 'delete-resource',
  discardEditorDraft: 'discard-draft',
} as const;

const editorDraftDiscardDescriptions: Record<NodeEditorGuardReason['kind'], string> = {
  'replace-node': 'Seleccionar otro nodo descartará el borrador actual.',
  'open-resource': 'Agregar un recurso a otro nodo descartará el borrador actual.',
  'deselect-node': 'Cerrar este nodo descartará el borrador actual.',
  'delete-node': 'Eliminar este nodo descartará el borrador actual.',
  'enter-canvas-preview':
    'La previsualización muestra solo lo guardado, así que se descartará el borrador actual.',
};

export function editorDraftDiscardConfirmation(
  destination: NodeEditorGuardReason,
): ConfirmationPresentation {
  return {
    title: '¿Descartar los cambios sin guardar?',
    description: editorDraftDiscardDescriptions[destination.kind],
    intent: 'destructive',
    cancelLabel: 'Seguir editando',
    actions: [
      {
        id: nodeEditorConfirmationActionIds.discardEditorDraft,
        label:
          destination.kind === 'enter-canvas-preview'
            ? 'Descartar y previsualizar'
            : 'Descartar y continuar',
      },
    ],
  };
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
  const source = roadmapNodeName(roadmap, sourceNodeId);

  return {
    title: (
      <>
        ¿Conectar {source} con {roadmapNodeName(roadmap, targetNodeId)}?
      </>
    ),
    description: (
      <>
        Como {source} tiene bloqueo docente, la conexión también bloqueará{' '}
        <Emphasis>{nodeCount(nodes.length)}</Emphasis>.
      </>
    ),
    intent: 'warning',
    actions: [{ id: canvasConfirmationChoices.createDependency, label: 'Conectar y bloquear' }],
  };
}

export function roadmapDependencyDeletionConfirmation(
  dependencyIds: readonly string[],
): ConfirmationPresentation {
  return {
    title:
      dependencyIds.length === 1
        ? '¿Eliminar la dependencia?'
        : `¿Eliminar ${dependencyIds.length} dependencias?`,
    description: 'Los nodos dejarán de estar conectados. Esta acción no se puede deshacer.',
    intent: 'destructive',
    actions: [{ id: canvasConfirmationChoices.deleteDependencies, label: 'Eliminar' }],
  };
}

type RoadmapTeacherBlockConfirmationInput = {
  roadmap: RoadmapConfirmationRoadmap;
  nodeId: string;
  preview: TeacherBlockOperationImpact;
  individualPreview?: TeacherBlockOperationImpact;
  branchPreview?: TeacherBlockOperationImpact;
  schedule?: UnlockScheduleDraft;
  isPending?: boolean;
};

export function affectedNodes(preview: TeacherBlockOperationImpact, nodeId: string) {
  return preview.nodes.filter((node) => node.id !== nodeId && node.relation !== 'SELECTED_NODE');
}

function releasableDependents(
  nodeId: string,
  individualPreview?: TeacherBlockOperationImpact,
  branchPreview?: TeacherBlockOperationImpact,
) {
  if (individualPreview?.mode !== 'SINGLE' || branchPreview?.mode !== 'BRANCH') return [];
  return affectedNodes(branchPreview, nodeId);
}

function dependentsStillBlocked(count: number) {
  return count === 1 ? (
    <>
      <Emphasis>1 nodo</Emphasis> que depende de él sigue bloqueado.
    </>
  ) : (
    <>
      <Emphasis>{count} nodos</Emphasis> que dependen de él siguen bloqueados.
    </>
  );
}

function unlockPresentation(
  title: ReactNode,
  description: ReactNode,
  actions: UnlockActions,
  schedule: UnlockScheduleDraft | undefined,
  isPending: boolean,
  scheduleHint: string | null,
): ConfirmationPresentation {
  const isMissingDate = !!schedule?.isScheduling && schedule.unlockAt === null;
  const primary = (action: ConfirmationAction): ConfirmationAction => ({
    ...action,
    emphasis: 'primary',
    ...(isMissingDate ? { disabled: true } : {}),
  });

  return {
    title,
    description,
    intent: 'default',
    ...(schedule
      ? {
          content: (
            <UnlockScheduleField
              draft={schedule}
              hint={scheduleHint ?? undefined}
              disabled={isPending}
            />
          ),
        }
      : {}),
    actions:
      actions.length === 1 ? [primary(actions[0])] : [primary(actions[0]), primary(actions[1])],
  };
}

export function roadmapTeacherBlockConfirmation({
  roadmap,
  nodeId,
  preview,
  individualPreview,
  branchPreview,
  schedule,
  isPending = false,
}: RoadmapTeacherBlockConfirmationInput): ConfirmationPresentation {
  const selected = preview.nodes.find(
    (node) => node.id === nodeId || node.relation === 'SELECTED_NODE',
  );
  const name = roadmapNodeName(roadmap, nodeId, selected);
  const verb = schedule?.isScheduling ? 'Programar' : 'Desbloquear';

  if (preview.mode === 'BLOCK') {
    const dependents = affectedNodes(preview, nodeId).length;
    return {
      title: <>¿Bloquear {name}?</>,
      description: (
        <>
          Los estudiantes no podrán acceder a él hasta que lo desbloquees.
          {dependents > 0 ? (
            <>
              {' '}
              También se {dependents === 1 ? 'bloqueará' : 'bloquearán'}{' '}
              <Emphasis>
                {dependents === 1
                  ? 'el nodo que depende de él'
                  : `los ${dependents} nodos que dependen de él`}
              </Emphasis>
              .
            </>
          ) : null}
        </>
      ),
      intent: 'destructive',
      actions: [{ id: canvasConfirmationChoices.blockTeacher, label: 'Bloquear nodo' }],
    };
  }

  const unlockTitle = <>¿Desbloquear {name}?</>;
  const opensLater = 'Los estudiantes podrán acceder a él cuando completen sus prerrequisitos.';

  if (preview.mode === 'UPSTREAM') {
    const prerequisites = affectedNodes(preview, nodeId).length;
    return unlockPresentation(
      unlockTitle,
      <>
        Para que los estudiantes puedan acceder a él, también se{' '}
        {prerequisites === 1 ? 'desbloqueará' : 'desbloquearán'}{' '}
        <Emphasis>
          {prerequisites === 1
            ? 'su prerrequisito bloqueado'
            : `sus ${prerequisites} prerrequisitos bloqueados`}
        </Emphasis>
        .
      </>,
      [
        {
          id: canvasConfirmationChoices.unlockPrerequisites,
          label: `${verb} ${nodeCount(preview.nodes.length)}`,
        },
      ],
      schedule,
      isPending,
      null,
    );
  }

  const dependents = releasableDependents(nodeId, individualPreview, branchPreview).length;
  if (dependents > 0) {
    return unlockPresentation(
      unlockTitle,
      <>
        {opensLater} {dependentsStillBlocked(dependents)}
      </>,
      [
        {
          id: canvasConfirmationChoices.unlockNode,
          label: schedule?.isScheduling ? 'Programar este nodo' : 'Solo este nodo',
        },
        {
          id: canvasConfirmationChoices.unlockBranch,
          label: schedule?.isScheduling ? 'Programar con dependientes' : 'Incluir dependientes',
        },
      ],
      schedule,
      isPending,
      scheduledUnlockPrerequisiteHint(0),
    );
  }

  return unlockPresentation(
    unlockTitle,
    opensLater,
    [{ id: canvasConfirmationChoices.unlockNode, label: verb }],
    schedule,
    isPending,
    scheduledUnlockPrerequisiteHint(0),
  );
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
  const losses = [
    resources.length === 1
      ? 'su recurso'
      : resources.length > 1
        ? `sus ${resources.length} recursos`
        : '',
    dependencies.length === 1
      ? 'su conexión'
      : dependencies.length > 1
        ? `sus ${dependencies.length} conexiones`
        : '',
  ].filter(Boolean);
  const verb =
    losses.length === 1 && resources.length + dependencies.length === 1
      ? 'eliminará'
      : 'eliminarán';

  return {
    title: (
      <>
        ¿Eliminar <NodeName title={node.title} nodeType={node.nodeType} />?
      </>
    ),
    description: `${
      losses.length ? `También se ${verb} ${sentenceList(losses)}. ` : ''
    }Esta acción no se puede deshacer.`,
    intent: 'destructive',
    actions: [{ id: canvasConfirmationChoices.deleteNode, label: 'Eliminar nodo' }],
  };
}

export function roadmapNodeVisibilityConfirmation(
  roadmap: RoadmapConfirmationRoadmap,
  node: RoadmapNodeIdentity,
  isHiding: boolean,
  dependencies: readonly StructuralDependency[],
): ConfirmationPresentation {
  const name = <NodeName title={node.title} nodeType={nodeTypeFor(roadmap, node.nodeTypeId)} />;

  if (!isHiding) {
    return {
      title: <>¿Mostrar {name}?</>,
      description: 'Los estudiantes podrán verlo y acceder a él de inmediato.',
      intent: 'default',
      actions: [{ id: canvasConfirmationChoices.showNode, label: 'Mostrar' }],
    };
  }

  const losses = [
    node.isTeacherBlocked ? 'se quitará su bloqueo docente' : '',
    dependencies.length === 1
      ? 'se eliminará su conexión'
      : dependencies.length > 1
        ? `se eliminarán sus ${dependencies.length} conexiones`
        : '',
  ].filter(Boolean);
  const consequences = losses.length
    ? ` Además, ${sentenceList(losses)}${
        dependencies.length ? '; al volver a mostrarlo, tendrás que conectarlo de nuevo' : ''
      }.`
    : '';

  return {
    title: <>¿Ocultar {name}?</>,
    description: `Dejará de aparecer en el roadmap de los estudiantes.${consequences}`,
    intent: 'destructive',
    actions: [{ id: canvasConfirmationChoices.hideNode, label: 'Ocultar' }],
  };
}

export function resourceDeletionConfirmation(resource: Resource): ConfirmationPresentation {
  return {
    title: (
      <>
        ¿Eliminar <span className="font-medium text-foreground">{resource.title}</span>?
      </>
    ),
    description: `Se quitará ${
      resource.type === 'FILE' ? 'este archivo' : 'este enlace'
    } del nodo. Esta acción no se puede deshacer.`,
    intent: 'destructive',
    actions: [{ id: nodeEditorConfirmationActionIds.deleteResource, label: 'Eliminar' }],
  };
}

export function nodeTypeDeletionConfirmation(
  nodeType: NodeTypePresentation & { id: string },
): ConfirmationPresentation {
  return {
    title: (
      <>
        ¿Eliminar el tipo <NodeName title={nodeType.name} nodeType={nodeType} />?
      </>
    ),
    description: 'Esta acción no se puede deshacer.',
    intent: 'destructive',
    actions: [{ id: canvasConfirmationChoices.deleteNodeType, label: 'Eliminar' }],
  };
}
