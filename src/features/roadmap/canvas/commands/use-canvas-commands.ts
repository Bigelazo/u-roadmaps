'use client';

import { useMemo, useRef, useState } from 'react';
import type {
  CanvasCommand,
  CanvasCommandOf,
  CanvasConfirmationChoice,
  ConfirmedActionKind,
  PendingConfirmation,
  UnconfirmedCommand,
  UnconfirmedCommandKind,
} from '@/features/roadmap/canvas/commands/commands';
import {
  confirmedActions,
  type ConfirmedAction,
  type ConfirmedActionContext,
} from '@/features/roadmap/canvas/commands/confirmed-actions';
import {
  unconfirmedWrites,
  type UnconfirmedWrite,
} from '@/features/roadmap/canvas/commands/unconfirmed-writes';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import { notify } from '@/shared/ui/notify';

/** The parts of the Roadmap canvas session the commands run through. */
export type CanvasCommandSession = {
  persistence: RoadmapCanvasSessionPersistence;
  stableInput: RoadmapCanvasSessionInput;
  read: <T>(operation: () => Promise<T>, fallback: string) => Promise<T | null>;
  mutate: <T>(
    operation: () => Promise<T>,
    fallback: string,
    reload?: boolean,
  ) => Promise<{ success: boolean; result: T | undefined }>;
  loadSimulation: () => Promise<boolean>;
};

type CanvasCommandsOptions = {
  session: CanvasCommandSession;
  guardDraft: NodeEditorHandle['guardDraft'];
  /**
   * Tells the view a command took effect, so it can follow up on its own state: select the
   * Node it created, close the editor after a Node deletion, or keep the direction of an
   * automatic layout.
   */
  onCommandApplied: (command: CanvasCommand, createdNodeId?: string) => void;
  /** Tells the Practice roadmap, when there is one, which action took effect. */
  report?: (action: PracticeCanvasAction) => void;
};

/** The canvas commands of a Roadmap canvas session and its single pending Confirmed action. */
export type CanvasCommands = {
  pending: PendingConfirmation | null;
  /**
   * Runs a command: an unconfirmed write applies at once, and a Confirmed action opens,
   * unless another one is pending. Resolves whether the command took effect; a Confirmed
   * action waiting for a choice has not yet.
   */
  request: (command: CanvasCommand) => Promise<boolean>;
  /** Confirms the awaiting Confirmed action with this choice. */
  confirm: (choice: CanvasConfirmationChoice) => Promise<void>;
  /** Drops the awaiting Confirmed action without changing anything. */
  cancel: () => void;
};

type AnyConfirmedAction = ConfirmedAction<ConfirmedActionKind>;

/** The declarations are typed per kind; the engine runs any of them on its own pending data. */
function declarationOf(kind: ConfirmedActionKind) {
  return confirmedActions[kind] as unknown as AnyConfirmedAction;
}

function isConfirmed(command: CanvasCommand): command is CanvasCommandOf<ConfirmedActionKind> {
  return Object.hasOwn(confirmedActions, command.kind);
}

function unconfirmedWriteOf(kind: UnconfirmedCommandKind) {
  return unconfirmedWrites[kind] as unknown as UnconfirmedWrite<UnconfirmedCommandKind>;
}

/** Change impacts come from deterministic reads, so equal content serializes equally. */
function sameChangeImpact(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
}

type OpenedRequest = {
  readonly kind: ConfirmedActionKind;
  readonly request: CanvasCommandOf<ConfirmedActionKind>;
};

function pendingConfirmation(
  { kind, request }: OpenedRequest,
  impact: unknown,
  phase: PendingConfirmation['phase'],
  choice?: CanvasConfirmationChoice,
) {
  return { kind, request, impact, phase, ...(choice ? { choice } : {}) } as PendingConfirmation;
}

/** Whether teaching staff must confirm this impact; an action without one always asks. */
function needsConfirmation(kind: ConfirmedActionKind, impact: unknown) {
  return impact === null || (declarationOf(kind).needsConfirmation?.(impact as never) ?? true);
}

/**
 * Runs every canvas write. Confirmed actions share a single pending slot: at most one is
 * reading its Change impact, awaiting a choice or confirming at a time. On confirmation the
 * Change impact is read again; a changed impact is shown instead of taking effect, and a
 * failed write shows the latest one. Unconfirmed writes apply at once. Each write that took
 * effect shows its toast and is reported to the Practice roadmap; a failure is the session
 * error.
 */
export function useCanvasCommands({
  session,
  guardDraft,
  onCommandApplied,
  report,
}: CanvasCommandsOptions): CanvasCommands {
  const [pending, setPendingState] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const { persistence, stableInput, read, mutate, loadSimulation } = session;

  const commands = useMemo(() => {
    const setPending = (next: PendingConfirmation | null) => {
      pendingRef.current = next;
      setPendingState(next);
    };
    /**
     * Writes, then reloads the Roadmap, or only the Canvas preview for a simulated write.
     * The write took effect once it succeeded: a failed reload is the session error, and a
     * superseded one leaves the newer reload to show it.
     */
    async function write<T>(
      operation: () => Promise<T>,
      fallback: string,
      reloads: 'roadmap' | 'canvas-preview' = 'roadmap',
    ) {
      const written = await mutate(operation, fallback, reloads === 'roadmap');
      if (written.success && reloads === 'canvas-preview') await loadSimulation();
      return written;
    }
    const context: ConfirmedActionContext = {
      read: (operation, fallback) => read(() => operation(persistence, stableInput), fallback),
      mutate: async (operation, fallback) =>
        (await write(() => operation(persistence, stableInput), fallback)).success,
      mutateCanvasPreview: async (operation, fallback) =>
        (await write(() => operation(persistence, stableInput), fallback, 'canvas-preview'))
          .success,
    };
    const isSlotFree = () => pendingRef.current === null;

    /** Applies an unconfirmed write; resolves whether it took effect. */
    async function perform(command: UnconfirmedCommand) {
      const declaration = unconfirmedWriteOf(command.kind);
      const { success, result } = await write(
        () => declaration.write(persistence, stableInput, command),
        declaration.fallback,
        declaration.reloads,
      );
      if (!success) return false;
      const message = declaration.success?.(command);
      if (message) notify.success(message);
      const action = declaration.report?.(command, result);
      if (action) report?.(action);
      onCommandApplied(command, result || undefined);
      return true;
    }

    /**
     * Runs the request; resolves whether all of it took effect. A partial success opens
     * what remains; a failure shows the latest Change impact again, or frees the slot when
     * it no longer needs confirming.
     */
    async function apply(
      opened: OpenedRequest,
      impact: unknown,
      choice?: CanvasConfirmationChoice,
    ): Promise<boolean> {
      const action = declarationOf(opened.kind);
      setPending(pendingConfirmation(opened, impact, 'confirming', choice));
      const result = await action.run(context, opened.request, impact as never, choice);
      if (result) {
        const remaining = result === true ? undefined : result.retry;
        const message = action.success?.(opened.request, choice, remaining);
        if (message) notify.success(message);
        if (remaining) return open({ kind: opened.kind, request: remaining });
        setPending(null);
        const practiceAction = action.report?.(opened.request, choice);
        if (practiceAction) report?.(practiceAction);
        onCommandApplied(opened.request);
        return true;
      }
      const latest =
        (action.readImpact && (await action.readImpact(context, opened.request))) ?? impact;
      setPending(
        needsConfirmation(opened.kind, latest)
          ? pendingConfirmation(opened, latest, 'awaiting')
          : null,
      );
      return false;
    }

    /** Waits for a choice on this impact, or applies it at once when it needs none. */
    async function present(opened: OpenedRequest, impact: unknown) {
      if (!needsConfirmation(opened.kind, impact)) return apply(opened, impact);
      setPending(pendingConfirmation(opened, impact, 'awaiting'));
      return false;
    }

    /** Reads the request's Change impact and presents it; a failed read frees the slot. */
    async function open(opened: OpenedRequest) {
      const action = declarationOf(opened.kind);
      if (!action.readImpact) return present(opened, null);
      setPending(pendingConfirmation(opened, null, 'reading-impact'));
      const impact = await action.readImpact(context, opened.request);
      if (impact) return present(opened, impact);
      setPending(null);
      return false;
    }

    async function request(command: CanvasCommand) {
      if (!isConfirmed(command)) return perform(command);
      if (!isSlotFree()) return false;
      // The draft question finishes before the slot is claimed, so it never locks the canvas.
      if (command.kind === 'delete-node') {
        const proceed = await guardDraft({ kind: 'delete-node', nodeId: command.nodeId });
        if (!proceed || !isSlotFree()) return false;
      }
      return open({ kind: command.kind, request: command });
    }

    async function confirm(choice: CanvasConfirmationChoice) {
      const awaiting = pendingRef.current;
      if (awaiting?.phase !== 'awaiting') return;
      const action = declarationOf(awaiting.kind);
      if (!action.readImpact) {
        await apply(awaiting, awaiting.impact, choice);
        return;
      }
      setPending(pendingConfirmation(awaiting, awaiting.impact, 'confirming', choice));
      const latest = await action.readImpact(context, awaiting.request);
      if (!latest) setPending(awaiting);
      else if (!sameChangeImpact(latest, awaiting.impact)) await present(awaiting, latest);
      else await apply(awaiting, latest, choice);
    }

    const cancel = () => {
      if (pendingRef.current?.phase === 'awaiting') setPending(null);
    };

    return { request, confirm, cancel };
  }, [
    guardDraft,
    loadSimulation,
    mutate,
    onCommandApplied,
    persistence,
    read,
    report,
    stableInput,
  ]);

  return { pending, ...commands };
}
