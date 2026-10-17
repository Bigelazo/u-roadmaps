import {
  roadmapConfirmationActionIds,
  type CanvasCommandOf,
  type ChangeImpactOf,
  type ConfirmedActionKind,
  type TeacherBlockChangeImpact,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';

type Operation<T> = (
  persistence: RoadmapCanvasSessionPersistence,
  input: RoadmapCanvasSessionInput,
) => Promise<T>;

/** What a Confirmed action can do: read through the session, write through it, and close the editor. */
export type ConfirmedActionContext = {
  /** Resolves `null` when the read fails; the session reports the failure. */
  preview: <T>(operation: Operation<T>, fallback: string) => Promise<T | null>;
  /** Resolves whether the write succeeded; the session reports a failure and reloads. */
  mutate: (operation: Operation<unknown>, fallback: string) => Promise<boolean>;
  closeEditor: () => void;
};

/**
 * One Confirmed action. Without `preview` it has no Change impact; with one, the engine
 * shows the impact, previews it again on confirmation and applies `run` only when it is
 * unchanged.
 */
export type ConfirmedAction<Kind extends ConfirmedActionKind> = {
  preview?: (
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
    choice: string | undefined,
  ) => Promise<boolean | { retry: CanvasCommandOf<Kind> }>;
  /** The toast shown once the request took effect, except for the `remaining` part. */
  success?: (request: CanvasCommandOf<Kind>, remaining?: CanvasCommandOf<Kind>) => string;
};

/** The unlock scopes teaching staff can choose between; blocking previews only itself. */
const teacherBlockPreviewOperations = (operation: TeacherBlockOperation) =>
  operation === 'BLOCK' ? (['BLOCK'] as const) : (['UNBLOCK', 'BRANCH_UNLOCK'] as const);

/** The operation each Teacher block choice applies; any other choice applies the requested one. */
const teacherBlockOperationByChoice: Readonly<Record<string, TeacherBlockOperation>> = {
  [roadmapConfirmationActionIds.blockTeacher]: 'BLOCK',
  [roadmapConfirmationActionIds.unlockNode]: 'UNBLOCK',
  [roadmapConfirmationActionIds.unlockBranch]: 'BRANCH_UNLOCK',
};

export const confirmedActions: { [Kind in ConfirmedActionKind]: ConfirmedAction<Kind> } = {
  'hide-node': {
    preview: ({ preview }, { nodeId }) =>
      preview(
        (persistence, input) => persistence.previewNodeHiding(input, nodeId),
        'No se pudo calcular el impacto de ocultar el nodo.',
      ),
    run: ({ mutate }, { nodeId }, impact) =>
      mutate(
        (persistence, input) => persistence.setVisibility(input, nodeId, false, impact.version),
        'No se pudo cambiar la visibilidad.',
      ),
  },
  'show-node': {
    run: ({ mutate }, { nodeId }) =>
      mutate(
        (persistence, input) => persistence.setVisibility(input, nodeId, true),
        'No se pudo cambiar la visibilidad.',
      ),
  },
  'delete-node': {
    preview: ({ preview }, { nodeId }) =>
      preview(
        (persistence, input) => persistence.previewNodeDeletion(input, nodeId),
        'No se pudo calcular el impacto de eliminar el nodo.',
      ),
    run: async ({ mutate, closeEditor }, { nodeId }, impact) => {
      const deleted = await mutate(
        (persistence, input) => persistence.deleteNode(input, nodeId, impact.version),
        'No se pudo eliminar el nodo.',
      );
      if (deleted) closeEditor();
      return deleted;
    },
  },
  'change-teacher-block': {
    preview: async ({ preview }, { nodeId, operation }) => {
      const operations = teacherBlockPreviewOperations(operation);
      const previews = await Promise.all(
        operations.map((previewed) =>
          preview(
            (persistence, input) => persistence.previewTeacherBlock(input, nodeId, previewed),
            'No se pudo calcular el impacto del bloqueo docente.',
          ),
        ),
      );
      const impact: TeacherBlockChangeImpact = Object.fromEntries(
        operations.flatMap((previewed, index) =>
          previews[index] ? [[previewed, previews[index]]] : [],
        ),
      );
      return impact[operation] ? impact : null;
    },
    run: ({ mutate }, { nodeId, operation }, impact, choice) => {
      const chosen = (choice && teacherBlockOperationByChoice[choice]) || operation;
      return mutate(
        (persistence, input) =>
          persistence.changeTeacherBlock(input, nodeId, chosen, impact[chosen]?.version),
        'No se pudo cambiar el bloqueo docente.',
      );
    },
  },
  'create-dependency': {
    preview: ({ preview }, dependency) =>
      preview(
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
};
