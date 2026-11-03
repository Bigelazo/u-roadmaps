import {
  canvasConfirmationChoices,
  type CanvasCommand,
  type CanvasCommandOf,
  type CanvasConfirmationChoice,
  type ChangeImpactCommand,
  type ChangeImpactOf,
  type ConfirmedActionKind,
  type PersistedCommand,
  type ReadChangeImpactOf,
  type TeacherBlockChangeImpact,
} from '@/features/roadmap/canvas/commands/commands';
import type { ExecutionResult, PracticeCanvasAction } from '@/features/roadmap/session/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';

/** The two guarded session operations the command engine runs commands through. */
export type CanvasCommandSession = {
  /** Resolves with nothing once the failure is reported or the Course offering changed. */
  readChangeImpact: <Command extends ChangeImpactCommand>(
    command: Command,
  ) => Promise<ReadChangeImpactOf<Command['kind']> | null>;
  execute: (
    command: PersistedCommand,
    previewVersion?: string,
  ) => Promise<{ readonly applied: boolean } & ExecutionResult>;
};

export type CommandOutcome<Kind extends CanvasCommand['kind']> = ExecutionResult & {
  readonly choice?: CanvasConfirmationChoice;
  /** The part of a Dependency deletion left pending for retry. */
  readonly remaining?: CanvasCommandOf<Kind>;
};

/**
 * How a Confirmed action reads its Change impact, if it has one, and applies once confirmed.
 * Members here and below are methods, so that one kind's entry reads as an entry for any kind.
 */
export type ConfirmedAction<Kind extends ConfirmedActionKind> = {
  impact?(
    session: CanvasCommandSession,
    command: CanvasCommandOf<Kind>,
  ): Promise<ChangeImpactOf[Kind] | null>;
  needsConfirmation?(impact: ChangeImpactOf[Kind]): boolean;
  apply(
    session: CanvasCommandSession,
    command: CanvasCommandOf<Kind>,
    impact: ChangeImpactOf[Kind],
    choice: CanvasConfirmationChoice | undefined,
  ): Promise<boolean | { retry: CanvasCommandOf<Kind> }>;
};

/** What the user sees of a command: its success message, Practice report and Confirmed action. */
export type CanvasCommandUx<Kind extends CanvasCommand['kind']> = {
  success?(command: CanvasCommandOf<Kind>, outcome: CommandOutcome<Kind>): string;
  report?(
    command: CanvasCommandOf<Kind>,
    outcome: CommandOutcome<Kind>,
  ): PracticeCanvasAction | null;
} & (Kind extends ConfirmedActionKind ? { confirmedAction: ConfirmedAction<Kind> } : unknown);

const readChangeImpact = <Command extends ChangeImpactCommand>(
  session: CanvasCommandSession,
  command: Command,
) => session.readChangeImpact(command);

/** Applies a Confirmed action as requested, with the version of the Change impact it showed. */
const executeAsRequested = async (
  session: CanvasCommandSession,
  command: PersistedCommand,
  impact: { readonly version: string } | null,
) => (await session.execute(command, impact?.version)).applied;

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

export const canvasCommandUx: {
  readonly [Kind in CanvasCommand['kind']]: CanvasCommandUx<Kind>;
} = {
  'hide-node': {
    confirmedAction: { impact: readChangeImpact, apply: executeAsRequested },
    success: () => 'Nodo ocultado exitosamente.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: false }),
  },
  'show-node': {
    confirmedAction: { apply: executeAsRequested },
    success: () => 'Nodo visible para estudiantes.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: true }),
  },
  'delete-node': {
    confirmedAction: { impact: readChangeImpact, apply: executeAsRequested },
    success: () => 'Nodo eliminado exitosamente.',
    report: ({ nodeId }) => ({ type: 'deleteNode', nodeId }),
  },
  'change-teacher-block': {
    confirmedAction: {
      impact: async (session, command) => {
        const operations = teacherBlockImpactOperations(command.operation);
        const impacts = await Promise.all(
          operations.map((operation) => session.readChangeImpact({ ...command, operation })),
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
    confirmedAction: {
      impact: readChangeImpact,
      needsConfirmation: (impact) => impact.nodes.length > 0,
      apply: executeAsRequested,
    },
    success: () => 'Dependencia creada exitosamente.',
    report: ({ sourceNodeId, targetNodeId }) => ({
      type: 'connectNodes',
      sourceNodeId,
      targetNodeId,
    }),
  },
  'delete-dependencies': {
    confirmedAction: {
      // One deletion per Dependency, so that only the failed ones stay pending for retry.
      apply: async (session, command) => {
        const deleted = await Promise.all(
          command.dependencyIds.map(
            async (dependencyId) =>
              (await session.execute({ kind: 'delete-dependency', dependencyId })).applied,
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
    confirmedAction: { apply: executeAsRequested },
    success: () => 'Nodos ordenados exitosamente.',
  },
  'delete-node-type': {
    confirmedAction: { apply: executeAsRequested },
    success: () => 'Tipo de nodo eliminado exitosamente.',
  },
  'reset-canvas-preview': {
    confirmedAction: { apply: executeAsRequested },
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
