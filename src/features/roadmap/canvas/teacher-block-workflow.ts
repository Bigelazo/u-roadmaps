'use client';

import { useCallback, useRef, useState } from 'react';
import {
  roadmapConfirmationActionIds,
  roadmapTeacherBlockConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type {
  AnyRoadmapDto,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

type TeacherBlockWorkflowRoadmap = Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'>;

type TeacherBlockPreviewState = {
  nodeId: string;
  operation: TeacherBlockOperation;
  preview: TeacherBlockPreview;
  individualPreview?: TeacherBlockPreview;
  branchPreview?: TeacherBlockPreview;
};

type TeacherBlockWorkflowState =
  | { kind: 'idle' }
  | { kind: 'previewing'; nodeId: string; operation: TeacherBlockOperation }
  | ({ kind: 'awaiting-confirmation' } & TeacherBlockPreviewState)
  | ({ kind: 'revalidating' } & TeacherBlockPreviewState & { actionId: string })
  | ({ kind: 'mutating' } & TeacherBlockPreviewState & { actionId: string });

type TeacherBlockWorkflowOptions = {
  roadmap: TeacherBlockWorkflowRoadmap | null;
  previewTeacherBlock: (
    nodeId: string,
    operation: TeacherBlockOperation,
  ) => Promise<TeacherBlockPreview | null>;
  changeTeacherBlock: (
    nodeId: string,
    operation: TeacherBlockOperation,
    previewVersion?: string,
  ) => Promise<boolean>;
};

type StateTransition =
  TeacherBlockWorkflowState | ((state: TeacherBlockWorkflowState) => TeacherBlockWorkflowState);

type AwaitingConfirmationState = Extract<
  TeacherBlockWorkflowState,
  { kind: 'awaiting-confirmation' }
>;

type RevalidatingState = Extract<TeacherBlockWorkflowState, { kind: 'revalidating' }>;

type MutatingState = Extract<TeacherBlockWorkflowState, { kind: 'mutating' }>;

function previewStateOf(pending: TeacherBlockPreviewState): TeacherBlockPreviewState {
  return {
    nodeId: pending.nodeId,
    operation: pending.operation,
    preview: pending.preview,
    ...(pending.individualPreview ? { individualPreview: pending.individualPreview } : {}),
    ...(pending.branchPreview ? { branchPreview: pending.branchPreview } : {}),
  };
}

function awaitingConfirmation(pending: TeacherBlockPreviewState): AwaitingConfirmationState {
  return { kind: 'awaiting-confirmation', ...previewStateOf(pending) };
}

function revalidating(pending: TeacherBlockPreviewState, actionId: string): RevalidatingState {
  return { kind: 'revalidating', ...previewStateOf(pending), actionId };
}

function mutating(pending: TeacherBlockPreviewState, actionId: string): MutatingState {
  return { kind: 'mutating', ...previewStateOf(pending), actionId };
}

function isUnlockScopeOperation(
  operation: TeacherBlockOperation,
): operation is Extract<TeacherBlockOperation, 'UNBLOCK' | 'BRANCH_UNLOCK'> {
  return operation === 'UNBLOCK' || operation === 'BRANCH_UNLOCK';
}

function teacherBlockPreviewForOperation(
  pending: TeacherBlockPreviewState,
  operation: TeacherBlockOperation,
): TeacherBlockPreview | null {
  if (pending.preview.mode === 'UPSTREAM') return pending.preview;
  if (operation === 'UNBLOCK') {
    return pending.individualPreview ?? (pending.operation === operation ? pending.preview : null);
  }
  if (operation === 'BRANCH_UNLOCK') {
    return pending.branchPreview ?? (pending.operation === operation ? pending.preview : null);
  }
  return pending.operation === operation ? pending.preview : null;
}

function replaceTeacherBlockPreview(
  pending: TeacherBlockPreviewState,
  operation: TeacherBlockOperation,
  preview: TeacherBlockPreview,
): TeacherBlockPreviewState {
  if (preview.mode === 'UPSTREAM') {
    return {
      nodeId: pending.nodeId,
      operation: pending.operation,
      preview,
    };
  }

  return {
    ...previewStateOf(pending),
    ...(pending.operation === operation ? { preview } : {}),
    ...(operation === 'UNBLOCK' ? { individualPreview: preview } : {}),
    ...(operation === 'BRANCH_UNLOCK' ? { branchPreview: preview } : {}),
  };
}

function isCompleteUnlockPreviewPair(pending: TeacherBlockPreviewState) {
  return pending.individualPreview?.mode === 'SINGLE' && pending.branchPreview?.mode === 'BRANCH';
}

function sameTeacherBlockPreview(first: TeacherBlockPreview, second: TeacherBlockPreview) {
  return (
    first.mode === second.mode &&
    first.version === second.version &&
    first.nodes.length === second.nodes.length &&
    first.nodes.every(
      (node, index) =>
        node.id === second.nodes[index]?.id &&
        node.title === second.nodes[index]?.title &&
        node.relation === second.nodes[index]?.relation &&
        node.nodeType?.name === second.nodes[index]?.nodeType?.name &&
        node.nodeType?.icon === second.nodes[index]?.nodeType?.icon &&
        node.nodeType?.color === second.nodes[index]?.nodeType?.color,
    )
  );
}

function isConfirmationState(
  state: TeacherBlockWorkflowState,
): state is Exclude<TeacherBlockWorkflowState, { kind: 'idle' | 'previewing' }> {
  return (
    state.kind === 'awaiting-confirmation' ||
    state.kind === 'revalidating' ||
    state.kind === 'mutating'
  );
}

function operationForAction(
  pending: TeacherBlockPreviewState,
  actionId: string,
): TeacherBlockOperation | null {
  switch (actionId) {
    case roadmapConfirmationActionIds.blockTeacher:
      return 'BLOCK';
    case roadmapConfirmationActionIds.unlockNode:
      return 'UNBLOCK';
    case roadmapConfirmationActionIds.unlockBranch:
      return 'BRANCH_UNLOCK';
    case roadmapConfirmationActionIds.unlockPrerequisites:
      return pending.operation;
    default:
      return null;
  }
}

export function useTeacherBlockWorkflow({
  roadmap,
  previewTeacherBlock,
  changeTeacherBlock,
}: TeacherBlockWorkflowOptions) {
  const [state, setState] = useState<TeacherBlockWorkflowState>({ kind: 'idle' });
  const stateRef = useRef<TeacherBlockWorkflowState>({ kind: 'idle' });

  const transition = useCallback((next: StateTransition) => {
    const nextState = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const loadPreviewSet = useCallback(
    async (
      nodeId: string,
      operation: TeacherBlockOperation,
    ): Promise<TeacherBlockPreviewState | null> => {
      const preview = await previewTeacherBlock(nodeId, operation);
      if (!preview) return null;

      if (isUnlockScopeOperation(operation) && preview.mode !== 'UPSTREAM') {
        const [individualPreview, branchPreview] = await Promise.all([
          operation === 'UNBLOCK'
            ? Promise.resolve(preview)
            : previewTeacherBlock(nodeId, 'UNBLOCK'),
          operation === 'BRANCH_UNLOCK'
            ? Promise.resolve(preview)
            : previewTeacherBlock(nodeId, 'BRANCH_UNLOCK'),
        ]);

        if (individualPreview?.mode === 'SINGLE' && branchPreview?.mode === 'BRANCH') {
          return {
            nodeId,
            operation,
            preview: operation === 'UNBLOCK' ? individualPreview : branchPreview,
            individualPreview,
            branchPreview,
          };
        }
      }

      return { nodeId, operation, preview };
    },
    [previewTeacherBlock],
  );

  const requestChange = useCallback(
    (nodeId: string, operation: TeacherBlockOperation) => {
      if (stateRef.current.kind !== 'idle') return;
      transition({ kind: 'previewing', nodeId, operation });

      void loadPreviewSet(nodeId, operation)
        .then((pending) => {
          transition(pending ? awaitingConfirmation(pending) : { kind: 'idle' });
        })
        .catch(() => transition({ kind: 'idle' }));
    },
    [loadPreviewSet, transition],
  );

  const cancel = useCallback(() => {
    transition((current) =>
      current.kind === 'awaiting-confirmation' ? { kind: 'idle' } : current,
    );
  }, [transition]);

  /**
   * Applies a refreshed preview and, for a complete unlock-scope pair, refreshes the paired scope.
   * When the paired refresh fails or breaks the pair, `fallbackToSelected` falls back to only the
   * selected operation's preview; otherwise the refreshed state is kept.
   */
  const refreshPreviewPair = useCallback(
    async (
      pending: TeacherBlockPreviewState,
      operation: TeacherBlockOperation,
      preview: TeacherBlockPreview,
      fallbackToSelected: boolean,
    ): Promise<TeacherBlockPreviewState> => {
      const refreshedPending = replaceTeacherBlockPreview(pending, operation, preview);
      if (
        !isUnlockScopeOperation(operation) ||
        preview.mode === 'UPSTREAM' ||
        !isCompleteUnlockPreviewPair(pending)
      ) {
        return refreshedPending;
      }

      const fallback = fallbackToSelected
        ? { nodeId: pending.nodeId, operation, preview }
        : refreshedPending;
      const otherOperation = operation === 'UNBLOCK' ? 'BRANCH_UNLOCK' : 'UNBLOCK';
      const otherPreview = await previewTeacherBlock(pending.nodeId, otherOperation);
      if (!otherPreview) return fallback;

      const pairedPending = replaceTeacherBlockPreview(
        refreshedPending,
        otherOperation,
        otherPreview,
      );
      return pairedPending.preview.mode === 'UPSTREAM' || isCompleteUnlockPreviewPair(pairedPending)
        ? pairedPending
        : fallback;
    },
    [previewTeacherBlock],
  );

  const confirmChange = useCallback(
    (operation: TeacherBlockOperation, actionId: string) => {
      const pending = stateRef.current;
      if (pending.kind !== 'awaiting-confirmation') return;

      const displayedPreview = teacherBlockPreviewForOperation(pending, operation);
      if (!displayedPreview) return;

      transition(revalidating(pending, actionId));

      void (async () => {
        try {
          const latestPreview = await previewTeacherBlock(pending.nodeId, operation);
          if (!latestPreview) {
            transition(awaitingConfirmation(pending));
            return;
          }

          if (!sameTeacherBlockPreview(displayedPreview, latestPreview)) {
            transition(
              awaitingConfirmation(
                await refreshPreviewPair(pending, operation, latestPreview, true),
              ),
            );
            return;
          }

          transition(mutating(pending, actionId));
          const changed = await changeTeacherBlock(
            pending.nodeId,
            operation,
            latestPreview.version,
          );
          if (changed) {
            transition({ kind: 'idle' });
            return;
          }

          const refreshedPreview = await previewTeacherBlock(pending.nodeId, operation);
          transition(
            awaitingConfirmation(
              refreshedPreview
                ? await refreshPreviewPair(pending, operation, refreshedPreview, false)
                : pending,
            ),
          );
        } catch {
          transition(awaitingConfirmation(pending));
        }
      })();
    },
    [changeTeacherBlock, previewTeacherBlock, refreshPreviewPair, transition],
  );

  const handleAction = useCallback(
    (actionId: string) => {
      const pending = stateRef.current;
      if (pending.kind !== 'awaiting-confirmation') return;

      const operation = operationForAction(pending, actionId);
      if (!operation || !teacherBlockPreviewForOperation(pending, operation)) return;
      confirmChange(operation, actionId);
    },
    [confirmChange],
  );

  const confirmationState = isConfirmationState(state) ? state : null;
  const confirmation =
    confirmationState && roadmap
      ? roadmapTeacherBlockConfirmation({
          roadmap,
          nodeId: confirmationState.nodeId,
          preview: confirmationState.preview,
          individualPreview: confirmationState.individualPreview,
          branchPreview: confirmationState.branchPreview,
        })
      : null;
  const pendingActionId =
    state.kind === 'revalidating' || state.kind === 'mutating' ? state.actionId : undefined;

  const confirmationDialog: ConfirmationDialogProps = {
    confirmation,
    pendingActionId,
    onCancel: cancel,
    onAction: handleAction,
  };

  return { requestChange, isBusy: state.kind !== 'idle', confirmationDialog };
}
