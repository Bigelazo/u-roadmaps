'use client';

import { useMemo, useRef, useState } from 'react';
import {
  canvasCommandCatalog,
  type AnyCommandEntry,
  type CanvasCommand,
  type ChangeImpactCommand,
  type CommandOutcome,
  type ConfirmationContext,
  type ConfirmationInput,
  type PendingConfirmation,
  type ReadChangeImpactOf,
} from '@/features/roadmap/canvas/commands/commands';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  CanvasConfirmationChoice,
  RoadmapConfirmationRoadmap,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { ExecutionResult, PracticeCanvasAction } from '@/features/roadmap/session/types';
import { notify } from '@/shared/ui/notify';

export type CanvasCommandSession = {
  readChangeImpact<Command extends ChangeImpactCommand>(
    command: Command,
  ): Promise<ReadChangeImpactOf<Command['kind']> | null>;
  execute(
    command: CanvasCommand,
    previewVersion?: string,
  ): Promise<{ readonly applied: boolean } & ExecutionResult>;
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
  confirm: (choice: CanvasConfirmationChoice, input?: ConfirmationInput) => Promise<void>;
  cancel: () => void;
};

type ConfirmedAction = NonNullable<AnyCommandEntry['confirmedAction']>;
type ChangeImpact = PendingConfirmation['impact'];

function entryOf(command: CanvasCommand): AnyCommandEntry {
  return canvasCommandCatalog[command.kind];
}

export function canvasConfirmation(
  pending: PendingConfirmation,
  roadmap: RoadmapConfirmationRoadmap,
  context: ConfirmationContext = {},
) {
  if (pending.phase === 'reading-impact') return null;
  return (
    entryOf(pending.request).confirmedAction?.confirmation(
      pending.request,
      pending.impact,
      roadmap,
      {
        ...context,
        isPending: pending.phase === 'confirming',
      },
    ) ?? null
  );
}

function sameChangeImpact(first: ChangeImpact, second: ChangeImpact) {
  return JSON.stringify(first) === JSON.stringify(second);
}

type OpenedRequest = {
  readonly request: CanvasCommand;
  readonly confirmedAction: ConfirmedAction;
};

function pendingConfirmation(
  { request }: OpenedRequest,
  impact: ChangeImpact,
  phase: PendingConfirmation['phase'],
  choice?: CanvasConfirmationChoice,
) {
  return {
    kind: request.kind,
    request,
    impact,
    phase,
    ...(choice ? { choice } : {}),
  } as PendingConfirmation;
}

function needsConfirmation({ confirmedAction }: OpenedRequest, impact: ChangeImpact) {
  return impact === null || (confirmedAction.needsConfirmation?.(impact) ?? true);
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
      outcome: CommandOutcome<CanvasCommand>,
      impact?: ChangeImpact,
    ) {
      const entry = entryOf(command);
      const message = entry.success?.(command, outcome, impact);
      if (message) notify.success(message);
      if (outcome.remaining) return;
      const action = entry.report?.(command, outcome);
      if (action) report?.(action);
      onCommandApplied(command, outcome.createdNodeId);
    }

    async function readImpact({ request, confirmedAction }: OpenedRequest) {
      return (await confirmedAction.impact?.(session, request)) ?? null;
    }

    async function perform(command: CanvasCommand) {
      const { applied, ...result } = await session.execute(command);
      if (applied) announceApplied(command, result);
      return applied;
    }

    async function applyConfirmed(
      opened: OpenedRequest,
      impact: ChangeImpact,
      choice?: CanvasConfirmationChoice,
      input?: ConfirmationInput,
    ): Promise<boolean> {
      setPending(pendingConfirmation(opened, impact, 'confirming', choice));
      const result = await opened.confirmedAction.apply(
        session,
        opened.request,
        impact,
        choice,
        input,
      );
      if (result) {
        const remaining = result === true ? undefined : result.retry;
        if (!remaining) setPending(null);
        announceApplied(opened.request, { choice, input, remaining }, impact);
        return remaining ? open({ ...opened, request: remaining }) : true;
      }
      const latest = (await readImpact(opened)) ?? impact;
      setPending(
        needsConfirmation(opened, latest) ? pendingConfirmation(opened, latest, 'awaiting') : null,
      );
      return false;
    }

    async function present(opened: OpenedRequest, impact: ChangeImpact) {
      if (!needsConfirmation(opened, impact)) return applyConfirmed(opened, impact);
      setPending(pendingConfirmation(opened, impact, 'awaiting'));
      return false;
    }

    async function open(opened: OpenedRequest) {
      if (!opened.confirmedAction.impact) return present(opened, null);
      setPending(pendingConfirmation(opened, null, 'reading-impact'));
      const impact = await readImpact(opened);
      if (impact) return present(opened, impact);
      setPending(null);
      return false;
    }

    async function request(command: CanvasCommand) {
      const { confirmedAction } = entryOf(command);
      if (!confirmedAction) return perform(command);
      if (!isSlotFree()) return false;
      const draft = confirmedAction.draftGuard?.(command);
      if (draft && (!(await guardDraft(draft)) || !isSlotFree())) return false;
      return open({ request: command, confirmedAction });
    }

    async function confirm(choice: CanvasConfirmationChoice, input?: ConfirmationInput) {
      const awaiting = pendingRef.current;
      const confirmedAction = awaiting && entryOf(awaiting.request).confirmedAction;
      if (awaiting?.phase !== 'awaiting' || !confirmedAction) return;
      const opened = { request: awaiting.request, confirmedAction };
      if (!confirmedAction.impact) {
        await applyConfirmed(opened, awaiting.impact, choice, input);
        return;
      }
      setPending(pendingConfirmation(opened, awaiting.impact, 'confirming', choice));
      const latest = await readImpact(opened);
      if (!latest) setPending(awaiting);
      else if (!sameChangeImpact(latest, awaiting.impact)) await present(opened, latest);
      else await applyConfirmed(opened, latest, choice, input);
    }

    const cancel = () => {
      if (pendingRef.current?.phase === 'awaiting') setPending(null);
    };

    return { request, confirm, cancel };
  }, [guardDraft, onCommandApplied, report, session]);

  return { pending, ...commands };
}
