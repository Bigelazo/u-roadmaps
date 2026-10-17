import type {
  CanvasCommandOf,
  ChangeImpactOf,
  ConfirmedActionKind,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

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
  /** Applies the confirmed request with its latest impact and resolves whether it succeeded. */
  run: (
    context: ConfirmedActionContext,
    request: CanvasCommandOf<Kind>,
    impact: ChangeImpactOf[Kind],
  ) => Promise<boolean>;
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
};
