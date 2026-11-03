'use client';

import { useMemo, useRef, useState } from 'react';
import type {
  CanvasCommand,
  CanvasCommandOf,
  CanvasConfirmationChoice,
  ChangeImpactOf,
  ConfirmedActionKind,
  PendingConfirmation,
  UnconfirmedCommand,
} from '@/features/roadmap/canvas/commands/commands';
import {
  canvasCommandUx,
  type CanvasCommandSession,
  type CanvasCommandUx,
  type CommandOutcome,
  type ConfirmedAction,
} from '@/features/roadmap/canvas/commands/canvas-command-ux';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { notify } from '@/shared/ui/notify';

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

type ChangeImpact = ChangeImpactOf[ConfirmedActionKind];

function confirmedActionOf(kind: ConfirmedActionKind): ConfirmedAction<ConfirmedActionKind> {
  return canvasCommandUx[kind].confirmedAction;
}

function isConfirmed(command: CanvasCommand): command is CanvasCommandOf<ConfirmedActionKind> {
  return 'confirmedAction' in canvasCommandUx[command.kind];
}

function sameChangeImpact(first: ChangeImpact, second: ChangeImpact) {
  return JSON.stringify(first) === JSON.stringify(second);
}

type OpenedRequest = {
  readonly kind: ConfirmedActionKind;
  readonly request: CanvasCommandOf<ConfirmedActionKind>;
};

/** TypeScript cannot tie a request and impact read for any kind back to their kind; they match. */
function pendingConfirmation(
  { kind, request }: OpenedRequest,
  impact: ChangeImpact,
  phase: PendingConfirmation['phase'],
  choice?: CanvasConfirmationChoice,
) {
  return { kind, request, impact, phase, ...(choice ? { choice } : {}) } as PendingConfirmation;
}

function needsConfirmation(kind: ConfirmedActionKind, impact: ChangeImpact) {
  return impact === null || (confirmedActionOf(kind).needsConfirmation?.(impact) ?? true);
}

export function useCanvasCommands({
  session,
  guardDraft,
  onCommandApplied,
  report,
}: CanvasCommandsOptions): CanvasCommands {
  const [pending, setPendingState] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  const commands = useMemo(() => {
    const setPending = (next: PendingConfirmation | null) => {
      pendingRef.current = next;
      setPendingState(next);
    };
    const isSlotFree = () => pendingRef.current === null;

    function announceApplied(
      command: CanvasCommand,
      outcome: CommandOutcome<CanvasCommand['kind']>,
    ) {
      const ux: CanvasCommandUx<CanvasCommand['kind']> = canvasCommandUx[command.kind];
      const message = ux.success?.(command, outcome);
      if (message) notify.success(message);
      if (outcome.remaining) return;
      const action = ux.report?.(command, outcome);
      if (action) report?.(action);
      onCommandApplied(command, outcome.createdNodeId);
    }

    async function readImpact({ kind, request }: OpenedRequest) {
      return (await confirmedActionOf(kind).impact?.(session, request)) ?? null;
    }

    async function perform(command: UnconfirmedCommand) {
      const { applied, ...result } = await session.execute(command);
      if (applied) announceApplied(command, result);
      return applied;
    }

    async function applyConfirmed(
      opened: OpenedRequest,
      impact: ChangeImpact,
      choice?: CanvasConfirmationChoice,
    ): Promise<boolean> {
      const confirmedAction = confirmedActionOf(opened.kind);
      setPending(pendingConfirmation(opened, impact, 'confirming', choice));
      const result = await confirmedAction.apply(session, opened.request, impact, choice);
      if (result) {
        const remaining = result === true ? undefined : result.retry;
        if (!remaining) setPending(null);
        announceApplied(opened.request, { choice, remaining });
        return remaining ? open({ kind: opened.kind, request: remaining }) : true;
      }
      const latest = (await readImpact(opened)) ?? impact;
      setPending(
        needsConfirmation(opened.kind, latest)
          ? pendingConfirmation(opened, latest, 'awaiting')
          : null,
      );
      return false;
    }

    async function present(opened: OpenedRequest, impact: ChangeImpact) {
      if (!needsConfirmation(opened.kind, impact)) return applyConfirmed(opened, impact);
      setPending(pendingConfirmation(opened, impact, 'awaiting'));
      return false;
    }

    async function open(opened: OpenedRequest) {
      if (!confirmedActionOf(opened.kind).impact) return present(opened, null);
      setPending(pendingConfirmation(opened, null, 'reading-impact'));
      const impact = await readImpact(opened);
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
      if (!confirmedActionOf(awaiting.kind).impact) {
        await applyConfirmed(awaiting, awaiting.impact, choice);
        return;
      }
      setPending(pendingConfirmation(awaiting, awaiting.impact, 'confirming', choice));
      const latest = await readImpact(awaiting);
      if (!latest) setPending(awaiting);
      else if (!sameChangeImpact(latest, awaiting.impact)) await present(awaiting, latest);
      else await applyConfirmed(awaiting, latest, choice);
    }

    const cancel = () => {
      if (pendingRef.current?.phase === 'awaiting') setPending(null);
    };

    return { request, confirm, cancel };
  }, [guardDraft, onCommandApplied, report, session]);

  return { pending, ...commands };
}
