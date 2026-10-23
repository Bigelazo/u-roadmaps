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
  onCommandApplied: (command: CanvasCommand, createdNodeId?: string) => void;
  report?: (action: PracticeCanvasAction) => void;
};

export type CanvasCommands = {
  pending: PendingConfirmation | null;
  request: (command: CanvasCommand) => Promise<boolean>;
  confirm: (choice: CanvasConfirmationChoice) => Promise<void>;
  cancel: () => void;
};

type AnyConfirmedAction = ConfirmedAction<ConfirmedActionKind>;

function declarationOf(kind: ConfirmedActionKind) {
  return confirmedActions[kind] as unknown as AnyConfirmedAction;
}

function isConfirmed(command: CanvasCommand): command is CanvasCommandOf<ConfirmedActionKind> {
  return Object.hasOwn(confirmedActions, command.kind);
}

function unconfirmedWriteOf(kind: UnconfirmedCommandKind) {
  return unconfirmedWrites[kind] as unknown as UnconfirmedWrite<UnconfirmedCommandKind>;
}

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

function needsConfirmation(kind: ConfirmedActionKind, impact: unknown) {
  return impact === null || (declarationOf(kind).needsConfirmation?.(impact as never) ?? true);
}

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

    async function present(opened: OpenedRequest, impact: unknown) {
      if (!needsConfirmation(opened.kind, impact)) return apply(opened, impact);
      setPending(pendingConfirmation(opened, impact, 'awaiting'));
      return false;
    }

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
