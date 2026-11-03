import {
  canvasConfirmationChoices,
  type CanvasCommand,
  type CanvasCommandOf,
  type CanvasConfirmationChoice,
  type ChangeImpactOf,
  type ConfirmedActionKind,
  type TeacherBlockChangeImpact,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  PracticeCanvasAction,
  PreviewImpactOf,
  PreviewedCommand,
} from '@/features/roadmap/session/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';

/** The two guarded session operations the command engine runs commands through. */
export type CanvasCommandSession = {
  /** Resolves with nothing once the failure is reported or the Course offering changed. */
  preview: <Command extends PreviewedCommand>(
    command: Command,
  ) => Promise<PreviewImpactOf[Command['kind']] | null>;
  execute: (
    command: CanvasCommand,
    previewVersion?: string,
  ) => Promise<{ readonly applied: boolean; readonly createdNodeId?: string }>;
};

export type CommandOutcome<Kind extends CanvasCommand['kind']> = {
  readonly choice?: CanvasConfirmationChoice;
  readonly createdNodeId?: string;
  /** The part of a Dependency deletion left pending for retry. */
  readonly remaining?: CanvasCommandOf<Kind>;
};

/**
 * How a Confirmed action asks first. By default it asks without a Change impact; with
 * `impact: 'preview'` it reads its Change impact with `preview(command)`. It applies with
 * `execute(command, impact.version)` unless `apply` overrides it.
 */
export type Confirmation<Kind extends ConfirmedActionKind> = {
  impact?:
    | 'preview'
    | ((
        session: CanvasCommandSession,
        command: CanvasCommandOf<Kind>,
      ) => Promise<ChangeImpactOf[Kind] | null>);
  needsConfirmation?: (impact: ChangeImpactOf[Kind]) => boolean;
  apply?: (
    session: CanvasCommandSession,
    command: CanvasCommandOf<Kind>,
    impact: ChangeImpactOf[Kind],
    choice: CanvasConfirmationChoice | undefined,
  ) => Promise<boolean | { retry: CanvasCommandOf<Kind> }>;
};

export type CommandDeclaration<Kind extends CanvasCommand['kind']> = {
  success?: (command: CanvasCommandOf<Kind>, outcome: CommandOutcome<Kind>) => string;
  report?: (
    command: CanvasCommandOf<Kind>,
    outcome: CommandOutcome<Kind>,
  ) => PracticeCanvasAction | null;
} & (Kind extends ConfirmedActionKind ? { confirmation: Confirmation<Kind> } : unknown);

const teacherBlockImpactOperations = (operation: TeacherBlockOperation) =>
  operation === 'BLOCK' ? (['BLOCK'] as const) : (['UNBLOCK', 'BRANCH_UNLOCK'] as const);

const teacherBlockOperationByChoice: Partial<
  Readonly<Record<CanvasConfirmationChoice, TeacherBlockOperation>>
> = {
  [canvasConfirmationChoices.blockTeacher]: 'BLOCK',
  [canvasConfirmationChoices.unlockNode]: 'UNBLOCK',
  [canvasConfirmationChoices.unlockBranch]: 'BRANCH_UNLOCK',
};

const chosenTeacherBlockOperation = (
  requested: TeacherBlockOperation,
  choice?: CanvasConfirmationChoice,
) => (choice && teacherBlockOperationByChoice[choice]) || requested;

const teacherBlockSuccess: Readonly<Record<TeacherBlockOperation, string>> = {
  BLOCK: 'Nodo bloqueado exitosamente.',
  UNBLOCK: 'Nodo desbloqueado exitosamente.',
  BRANCH_UNLOCK: 'Rama desbloqueada exitosamente.',
};

const completionSuccess = () => 'Nodo completado.';

export const commandDeclarations: {
  readonly [Kind in CanvasCommand['kind']]: CommandDeclaration<Kind>;
} = {
  'hide-node': {
    confirmation: { impact: 'preview' },
    success: () => 'Nodo ocultado exitosamente.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: false }),
  },
  'show-node': {
    confirmation: {},
    success: () => 'Nodo visible para estudiantes.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: true }),
  },
  'delete-node': {
    confirmation: { impact: 'preview' },
    success: () => 'Nodo eliminado exitosamente.',
    report: ({ nodeId }) => ({ type: 'deleteNode', nodeId }),
  },
  'change-teacher-block': {
    confirmation: {
      impact: async (session, command) => {
        const operations = teacherBlockImpactOperations(command.operation);
        const impacts = await Promise.all(
          operations.map((operation) => session.preview({ ...command, operation })),
        );
        const impact: TeacherBlockChangeImpact = Object.fromEntries(
          operations.flatMap((operation, index) =>
            impacts[index] ? [[operation, impacts[index]]] : [],
          ),
        );
        return impact[command.operation] ? impact : null;
      },
      apply: async (session, command, impact, choice) => {
        const operation = chosenTeacherBlockOperation(command.operation, choice);
        return (await session.execute({ ...command, operation }, impact[operation]?.version))
          .applied;
      },
    },
    success: ({ operation }, { choice }) =>
      choice === canvasConfirmationChoices.unlockPrerequisites
        ? 'Nodos desbloqueados exitosamente.'
        : teacherBlockSuccess[chosenTeacherBlockOperation(operation, choice)],
    report: ({ nodeId, operation }, { choice }) => ({
      type: 'changeTeacherBlock',
      nodeId,
      operation: chosenTeacherBlockOperation(operation, choice),
    }),
  },
  'create-dependency': {
    confirmation: { impact: 'preview', needsConfirmation: (impact) => impact.nodes.length > 0 },
    success: () => 'Dependencia creada exitosamente.',
    report: ({ sourceNodeId, targetNodeId }) => ({
      type: 'connectNodes',
      sourceNodeId,
      targetNodeId,
    }),
  },
  'delete-dependencies': {
    confirmation: {
      // One deletion per Dependency, so that only the failed ones stay pending for retry.
      apply: async (session, command) => {
        const deleted = await Promise.all(
          command.dependencyIds.map(
            async (dependencyId) =>
              (
                await session.execute({
                  kind: 'delete-dependencies',
                  dependencyIds: [dependencyId],
                })
              ).applied,
          ),
        );
        const failed = command.dependencyIds.filter((_, index) => !deleted[index]);
        if (failed.length === 0) return true;
        if (failed.length === command.dependencyIds.length) return false;
        return { retry: { ...command, dependencyIds: failed } };
      },
    },
    success: ({ dependencyIds }, { remaining }) =>
      dependencyIds.length - (remaining?.dependencyIds.length ?? 0) === 1
        ? 'Dependencia eliminada exitosamente.'
        : 'Dependencias eliminadas exitosamente.',
  },
  'apply-automatic-layout': {
    confirmation: {},
    success: () => 'Nodos ordenados exitosamente.',
  },
  'delete-node-type': {
    confirmation: {},
    success: () => 'Tipo de nodo eliminado exitosamente.',
  },
  'reset-canvas-preview': {
    confirmation: {},
    success: () => 'Progreso de previsualización reiniciado.',
  },
  'add-node': {
    success: () => 'Nodo creado exitosamente.',
    report: (_, { createdNodeId }) =>
      createdNodeId ? { type: 'addNode', nodeId: createdNodeId } : null,
  },
  'update-node': { success: () => 'Cambios guardados exitosamente.' },
  'move-nodes': {},
  'schedule-teacher-unlock': {
    success: ({ unlockOn }) =>
      unlockOn ? 'Desbloqueo programado.' : 'Desbloqueo programado cancelado.',
  },
  'add-resource': {
    success: () => 'Enlace guardado exitosamente.',
    report: ({ nodeId }) => ({ type: 'addResource', nodeId }),
  },
  'upload-resource': { success: () => 'Recurso guardado exitosamente.' },
  'update-resource': {
    success: ({ resource }) =>
      resource.type === 'LINK' ? 'Enlace guardado exitosamente.' : 'Recurso guardado exitosamente.',
  },
  'delete-resource': { success: () => 'Recurso eliminado exitosamente.' },
  'add-node-type': { success: () => 'Tipo de nodo creado exitosamente.' },
  'update-node-type': { success: () => 'Tipo de nodo guardado exitosamente.' },
  'complete-node': { success: completionSuccess },
  'complete-canvas-preview-node': {
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeCanvasPreviewNode', nodeId }),
  },
};
