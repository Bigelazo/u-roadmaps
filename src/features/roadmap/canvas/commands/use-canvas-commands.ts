'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  CanvasCommandOf,
  ConfirmedActionKind,
  PendingConfirmation,
} from '@/features/roadmap/canvas/commands/commands';
import {
  confirmedActions,
  type ConfirmedAction,
  type ConfirmedActionContext,
} from '@/features/roadmap/canvas/commands/confirmed-actions';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

/** The parts of the Roadmap canvas session the commands run through. */
export type CanvasCommandSession = {
  persistence: RoadmapCanvasSessionPersistence;
  stableInput: RoadmapCanvasSessionInput;
  preview: <T>(operation: () => Promise<T>, fallback: string) => Promise<T | null>;
  mutate: <T>(operation: () => Promise<T>, fallback: string) => Promise<{ success: boolean }>;
};

type CanvasCommandsOptions = {
  session: CanvasCommandSession;
  guardDraft: NodeEditorHandle['guardDraft'];
  closeEditor: () => void;
  /** Confirmations the view still coordinates itself; none may open beside the pending one. */
  isOtherConfirmationOpen: () => boolean;
};

type AnyConfirmedAction = ConfirmedAction<ConfirmedActionKind>;

/** The declarations are typed per kind; the engine runs any of them on its own pending data. */
function declarationOf(kind: ConfirmedActionKind) {
  return confirmedActions[kind] as unknown as AnyConfirmedAction;
}

/** Change impacts come from deterministic previews, so equal content serializes equally. */
function sameChangeImpact(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * Runs Confirmed actions with a single pending slot: at most one is previewing, awaiting a
 * choice or confirming at a time. On confirmation the Change impact is previewed again; a
 * changed impact is shown instead of taking effect, and a failed write shows the latest one.
 */
export function useCanvasCommands({
  session,
  guardDraft,
  closeEditor,
  isOtherConfirmationOpen,
}: CanvasCommandsOptions) {
  const [pending, setPendingState] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const setPending = useCallback((next: PendingConfirmation | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);

  const { persistence, stableInput, preview, mutate } = session;
  const context = useMemo<ConfirmedActionContext>(
    () => ({
      preview: (operation, fallback) =>
        preview(() => operation(persistence, stableInput), fallback),
      mutate: async (operation, fallback) =>
        (await mutate(() => operation(persistence, stableInput), fallback)).success,
      closeEditor,
    }),
    [closeEditor, mutate, persistence, preview, stableInput],
  );

  const isSlotFree = useCallback(
    () => pendingRef.current === null && !isOtherConfirmationOpen(),
    [isOtherConfirmationOpen],
  );

  const request = useCallback(
    async (command: CanvasCommandOf<ConfirmedActionKind>) => {
      if (!isSlotFree()) return;
      // The draft question finishes before the slot is claimed, so it never locks the canvas.
      if (command.kind === 'delete-node') {
        const proceed = await guardDraft({ kind: 'delete-node', nodeId: command.nodeId });
        if (!proceed || !isSlotFree()) return;
      }
      const action = declarationOf(command.kind);
      const opened = { kind: command.kind, request: command, impact: null } as const;
      if (!action.preview) {
        setPending({ ...opened, phase: 'awaiting' } as PendingConfirmation);
        return;
      }
      const previewing = { ...opened, phase: 'previewing' } as PendingConfirmation;
      setPending(previewing);
      const impact = await action.preview(context, command);
      setPending(
        impact ? ({ ...previewing, impact, phase: 'awaiting' } as PendingConfirmation) : null,
      );
    },
    [context, guardDraft, isSlotFree, setPending],
  );

  const confirm = useCallback(
    async (choice: string) => {
      const awaiting = pendingRef.current;
      if (awaiting?.phase !== 'awaiting') return;
      const action = declarationOf(awaiting.kind);
      const withImpact = (impact: typeof awaiting.impact) =>
        ({ ...awaiting, impact: impact ?? awaiting.impact }) as PendingConfirmation;
      setPending({ ...awaiting, phase: 'confirming', choice });

      let impact = awaiting.impact;
      if (action.preview) {
        const latest = await action.preview(context, awaiting.request);
        if (!latest || !sameChangeImpact(latest, awaiting.impact)) {
          setPending(withImpact(latest));
          return;
        }
        impact = latest;
      }
      if (await action.run(context, awaiting.request, impact)) {
        setPending(null);
        return;
      }
      setPending(
        withImpact(action.preview ? await action.preview(context, awaiting.request) : null),
      );
    },
    [context, setPending],
  );

  const cancel = useCallback(() => {
    if (pendingRef.current?.phase === 'awaiting') setPending(null);
  }, [setPending]);

  const hasPending = useCallback(() => pendingRef.current !== null, []);

  return { pending, hasPending, request, confirm, cancel };
}
