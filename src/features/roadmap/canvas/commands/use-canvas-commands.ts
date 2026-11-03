'use client';

import { useMemo, useRef, useState } from 'react';
import type {
  CanvasCommand,
  CanvasCommandOf,
  CanvasConfirmationChoice,
  ConfirmedActionKind,
  PendingConfirmation,
} from '@/features/roadmap/canvas/commands/commands';
import {
  commandDeclarations,
  type CanvasCommandSession,
  type CommandDeclaration,
  type CommandOutcome,
  type Confirmation,
} from '@/features/roadmap/canvas/commands/declarations';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type { PracticeCanvasAction, PreviewedCommand } from '@/features/roadmap/session/types';
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

type AnyDeclaration = CommandDeclaration<CanvasCommand['kind']>;

function declarationOf(kind: CanvasCommand['kind']) {
  return commandDeclarations[kind] as AnyDeclaration;
}

function confirmationOf(kind: ConfirmedActionKind) {
  return (commandDeclarations[kind] as { confirmation: Confirmation<ConfirmedActionKind> })
    .confirmation;
}

function isConfirmed(command: CanvasCommand): command is CanvasCommandOf<ConfirmedActionKind> {
  return 'confirmation' in commandDeclarations[command.kind];
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
  return impact === null || (confirmationOf(kind).needsConfirmation?.(impact as never) ?? true);
}

function versionOf(impact: unknown) {
  return (impact as { version?: string } | null)?.version;
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

    function applied(command: CanvasCommand, outcome: CommandOutcome<CanvasCommand['kind']>) {
      const declaration = declarationOf(command.kind);
      const message = declaration.success?.(command, outcome);
      if (message) notify.success(message);
      if (outcome.remaining) return;
      const action = declaration.report?.(command, outcome);
      if (action) report?.(action);
      if (outcome.createdNodeId) onCommandApplied(command, outcome.createdNodeId);
      else onCommandApplied(command);
    }

    async function readImpact({ kind, request }: OpenedRequest) {
      const { impact } = confirmationOf(kind);
      if (impact === 'preview') return session.preview(request as PreviewedCommand);
      return impact ? impact(session, request) : null;
    }

    async function perform(command: CanvasCommand) {
      const { applied: performed, createdNodeId } = await session.execute(command);
      if (performed) applied(command, { createdNodeId });
      return performed;
    }

    async function apply(
      opened: OpenedRequest,
      impact: unknown,
      choice?: CanvasConfirmationChoice,
    ): Promise<boolean> {
      const confirmation = confirmationOf(opened.kind);
      setPending(pendingConfirmation(opened, impact, 'confirming', choice));
      const result = confirmation.apply
        ? await confirmation.apply(session, opened.request, impact as never, choice)
        : (await session.execute(opened.request, versionOf(impact))).applied;
      if (result) {
        const remaining = result === true ? undefined : result.retry;
        if (!remaining) setPending(null);
        applied(opened.request, { choice, remaining });
        return remaining ? open({ kind: opened.kind, request: remaining }) : true;
      }
      const latest = (confirmation.impact && (await readImpact(opened))) ?? impact;
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
      if (!confirmationOf(opened.kind).impact) return present(opened, null);
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
      if (!confirmationOf(awaiting.kind).impact) {
        await apply(awaiting, awaiting.impact, choice);
        return;
      }
      setPending(pendingConfirmation(awaiting, awaiting.impact, 'confirming', choice));
      const latest = await readImpact(awaiting);
      if (!latest) setPending(awaiting);
      else if (!sameChangeImpact(latest, awaiting.impact)) await present(awaiting, latest);
      else await apply(awaiting, latest, choice);
    }

    const cancel = () => {
      if (pendingRef.current?.phase === 'awaiting') setPending(null);
    };

    return { request, confirm, cancel };
  }, [guardDraft, onCommandApplied, report, session]);

  return { pending, ...commands };
}
