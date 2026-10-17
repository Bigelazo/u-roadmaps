import {
  canvasConfirmationChoices,
  type CanvasCommandOf,
  type CanvasConfirmationChoice,
  type ChangeImpactOf,
  type ConfirmedActionKind,
  type TeacherBlockChangeImpact,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';
import { unconfirmedWrites } from '@/features/roadmap/canvas/commands/unconfirmed-writes';

type Operation<T> = (
  persistence: RoadmapCanvasSessionPersistence,
  input: RoadmapCanvasSessionInput,
) => Promise<T>;

/** What a Confirmed action can do: read and write through the session. */
export type ConfirmedActionContext = {
  /** Resolves `null` when the read fails; the session reports the failure. */
  read: <T>(operation: Operation<T>, fallback: string) => Promise<T | null>;
  /** Resolves whether the write succeeded; the session reports a failure and reloads. */
  mutate: (operation: Operation<unknown>, fallback: string) => Promise<boolean>;
  /** Like `mutate`, but for a Canvas preview write: it reloads the Canvas preview instead. */
  mutateCanvasPreview: (operation: Operation<unknown>, fallback: string) => Promise<boolean>;
};

/**
 * One Confirmed action. Without `readImpact` it has no Change impact; with it, the engine
 * shows the impact, reads it again on confirmation and applies `run` only when it is
 * unchanged.
 */
export type ConfirmedAction<Kind extends ConfirmedActionKind> = {
  readImpact?: (
    context: ConfirmedActionContext,
    request: CanvasCommandOf<Kind>,
  ) => Promise<ChangeImpactOf[Kind] | null>;
  /** Whether this impact needs teaching staff to confirm it; otherwise it applies at once. */
  needsConfirmation?: (impact: ChangeImpactOf[Kind]) => boolean;
  /**
   * Applies the request with its latest impact and the confirmation choice teaching staff
   * made. Resolves whether it succeeded, or, when only part of it did, the rest to confirm
   * again.
   */
  run: (
    context: ConfirmedActionContext,
    request: CanvasCommandOf<Kind>,
    impact: ChangeImpactOf[Kind],
    choice: CanvasConfirmationChoice | undefined,
  ) => Promise<boolean | { retry: CanvasCommandOf<Kind> }>;
  /** The toast shown once the request took effect, except for the `remaining` part. */
  success?: (request: CanvasCommandOf<Kind>, remaining?: CanvasCommandOf<Kind>) => string;
  /** What the Practice roadmap is told once the whole request took effect. */
  report?: (
    request: CanvasCommandOf<Kind>,
    choice: CanvasConfirmationChoice | undefined,
  ) => PracticeCanvasAction;
};

/** The unlock scopes teaching staff can choose between; blocking reads only its own impact. */
const teacherBlockImpactOperations = (operation: TeacherBlockOperation) =>
  operation === 'BLOCK' ? (['BLOCK'] as const) : (['UNBLOCK', 'BRANCH_UNLOCK'] as const);

/** The operation each Teacher block choice applies; any other choice applies the requested one. */
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

const visibilityFailure = 'No se pudo cambiar la visibilidad.';

export const confirmedActions: { [Kind in ConfirmedActionKind]: ConfirmedAction<Kind> } = {
  'hide-node': {
    readImpact: ({ read }, { nodeId }) =>
      read(
        (persistence, input) => persistence.previewNodeHiding(input, nodeId),
        'No se pudo calcular el impacto de ocultar el nodo.',
      ),
    run: ({ mutate }, { nodeId }, impact) =>
      mutate(
        (persistence, input) => persistence.setVisibility(input, nodeId, false, impact.version),
        visibilityFailure,
      ),
    success: () => 'Nodo ocultado exitosamente.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: false }),
  },
  'show-node': {
    run: ({ mutate }, { nodeId }) =>
      mutate(
        (persistence, input) => persistence.setVisibility(input, nodeId, true),
        visibilityFailure,
      ),
    success: () => 'Nodo visible para estudiantes.',
    report: ({ nodeId }) => ({ type: 'changeVisibility', nodeId, isVisible: true }),
  },
  'delete-node': {
    readImpact: ({ read }, { nodeId }) =>
      read(
        (persistence, input) => persistence.previewNodeDeletion(input, nodeId),
        'No se pudo calcular el impacto de eliminar el nodo.',
      ),
    run: ({ mutate }, { nodeId }, impact) =>
      mutate(
        (persistence, input) => persistence.deleteNode(input, nodeId, impact.version),
        'No se pudo eliminar el nodo.',
      ),
    success: () => 'Nodo eliminado exitosamente.',
    report: ({ nodeId }) => ({ type: 'deleteNode', nodeId }),
  },
  'change-teacher-block': {
    readImpact: async ({ read }, { nodeId, operation }) => {
      const operations = teacherBlockImpactOperations(operation);
      const impacts = await Promise.all(
        operations.map((scope) =>
          read(
            (persistence, input) => persistence.previewTeacherBlock(input, nodeId, scope),
            'No se pudo calcular el impacto del bloqueo docente.',
          ),
        ),
      );
      const impact: TeacherBlockChangeImpact = Object.fromEntries(
        operations.flatMap((scope, index) => (impacts[index] ? [[scope, impacts[index]]] : [])),
      );
      return impact[operation] ? impact : null;
    },
    run: ({ mutate }, { nodeId, operation }, impact, choice) => {
      const chosen = chosenTeacherBlockOperation(operation, choice);
      return mutate(
        (persistence, input) =>
          persistence.changeTeacherBlock(input, nodeId, chosen, impact[chosen]?.version),
        'No se pudo cambiar el bloqueo docente.',
      );
    },
    report: ({ nodeId, operation }, choice) => ({
      type: 'changeTeacherBlock',
      nodeId,
      operation: chosenTeacherBlockOperation(operation, choice),
    }),
  },
  'create-dependency': {
    readImpact: ({ read }, dependency) =>
      read(
        (persistence, input) => persistence.previewRoadmapDependency(input, dependency),
        'No se pudo calcular el impacto de la dependencia.',
      ),
    needsConfirmation: (impact) => impact.nodes.length > 0,
    run: ({ mutate }, dependency, impact) =>
      mutate(
        (persistence, input) => persistence.connectNodes(input, dependency, impact.version),
        'No se pudo crear la dependencia.',
      ),
    success: () => 'Dependencia creada exitosamente.',
    report: ({ sourceNodeId, targetNodeId }) => ({
      type: 'connectNodes',
      sourceNodeId,
      targetNodeId,
    }),
  },
  'delete-dependencies': {
    run: async ({ mutate }, request) => {
      const deleted = await Promise.all(
        request.dependencyIds.map((dependencyId) =>
          mutate(
            (persistence, input) => persistence.deleteDependency(input, dependencyId),
            'No se pudo eliminar la dependencia.',
          ),
        ),
      );
      const failed = request.dependencyIds.filter((_, index) => !deleted[index]);
      if (failed.length === 0) return true;
      if (failed.length === request.dependencyIds.length) return false;
      return { retry: { ...request, dependencyIds: failed } };
    },
    success: ({ dependencyIds }, remaining) =>
      dependencyIds.length - (remaining?.dependencyIds.length ?? 0) === 1
        ? 'Dependencia eliminada exitosamente.'
        : 'Dependencias eliminadas exitosamente.',
  },
  'apply-automatic-layout': {
    /** The confirmed layout is written as one Node move. */
    run: ({ mutate }, { positions }) => {
      const { write, fallback } = unconfirmedWrites['move-nodes'];
      return mutate(
        (persistence, input) => write(persistence, input, { kind: 'move-nodes', positions }),
        fallback,
      );
    },
    success: () => 'Nodos ordenados exitosamente.',
  },
  'delete-node-type': {
    run: ({ mutate }, { nodeTypeId }) =>
      mutate(
        (persistence, input) => persistence.deleteNodeType(input, nodeTypeId),
        'No se pudo eliminar el tipo de nodo.',
      ),
    success: () => 'Tipo de nodo eliminado exitosamente.',
  },
  'reset-canvas-preview': {
    run: ({ mutateCanvasPreview }) =>
      mutateCanvasPreview(
        (persistence, input) => persistence.resetSimulation(input),
        'No se pudo reiniciar el progreso de previsualización.',
      ),
    success: () => 'Progreso de previsualización reiniciado.',
  },
};
