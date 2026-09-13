'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import {
  nodeDeletionConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { RoadmapEditorDraftHandle } from '@/features/roadmap/editor/types';
import type { NodeDeletionImpact } from '@/features/roadmap/types';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

export type NodeDeletionRequestOptions = {
  draftWasDiscarded?: boolean;
};

type NodeDeletionPreviewState = {
  nodeId: string;
  draftWasDiscarded: boolean;
  impact: NodeDeletionImpact;
};

type NodeDeletionWorkflowState =
  | { kind: 'idle' }
  | { kind: 'previewing'; nodeId: string; draftWasDiscarded: boolean }
  | ({ kind: 'awaiting-confirmation' } & NodeDeletionPreviewState)
  | ({ kind: 'revalidating' } & NodeDeletionPreviewState & { actionId: string })
  | ({ kind: 'mutating' } & NodeDeletionPreviewState & { actionId: string });

type AwaitingConfirmationState = Extract<
  NodeDeletionWorkflowState,
  { kind: 'awaiting-confirmation' }
>;

type RevalidatingState = Extract<NodeDeletionWorkflowState, { kind: 'revalidating' }>;
type MutatingState = Extract<NodeDeletionWorkflowState, { kind: 'mutating' }>;

type StateTransition =
  | NodeDeletionWorkflowState
  | ((state: NodeDeletionWorkflowState) => NodeDeletionWorkflowState);

type NodeDeletionWorkflowOptions = {
  previewNodeDeletion: (nodeId: string) => Promise<NodeDeletionImpact | null>;
  deleteNode: (nodeId: string, previewVersion?: string) => Promise<boolean>;
  requestEditorDraftDiscard: (nodeId: string) => boolean;
  editorDraftRef: RefObject<RoadmapEditorDraftHandle | null>;
  closeEditor: () => void;
};

function awaitingConfirmation(pending: NodeDeletionPreviewState): AwaitingConfirmationState {
  return { kind: 'awaiting-confirmation', ...pending };
}

function previewStateOf(pending: NodeDeletionPreviewState): NodeDeletionPreviewState {
  return {
    nodeId: pending.nodeId,
    draftWasDiscarded: pending.draftWasDiscarded,
    impact: pending.impact,
  };
}

function revalidating(pending: NodeDeletionPreviewState, actionId: string): RevalidatingState {
  return { kind: 'revalidating', ...previewStateOf(pending), actionId };
}

function mutating(pending: NodeDeletionPreviewState, actionId: string): MutatingState {
  return { kind: 'mutating', ...previewStateOf(pending), actionId };
}

function sameNodeDeletionImpact(first: NodeDeletionImpact, second: NodeDeletionImpact) {
  if (first.version !== second.version) return false;
  if (first.node.title !== second.node.title) return false;
  if (first.node.nodeType.name !== second.node.nodeType.name) return false;
  if (first.node.nodeType.icon !== second.node.nodeType.icon) return false;
  if (first.node.nodeType.color !== second.node.nodeType.color) return false;
  if (first.dependencies.length !== second.dependencies.length) return false;
  if (
    !first.dependencies.every(
      (dependency, index) =>
        dependency.id === second.dependencies[index]?.id &&
        dependency.sourceTitle === second.dependencies[index]?.sourceTitle &&
        dependency.targetTitle === second.dependencies[index]?.targetTitle,
    )
  )
    return false;
  if (first.resources.length !== second.resources.length) return false;
  return first.resources.every(
    (resource, index) =>
      resource.id === second.resources[index]?.id &&
      resource.title === second.resources[index]?.title,
  );
}

export function useNodeDeletionWorkflow({
  previewNodeDeletion,
  deleteNode,
  requestEditorDraftDiscard,
  editorDraftRef,
  closeEditor,
}: NodeDeletionWorkflowOptions) {
  const [state, setState] = useState<NodeDeletionWorkflowState>({ kind: 'idle' });
  const stateRef = useRef<NodeDeletionWorkflowState>({ kind: 'idle' });

  const transition = useCallback((next: StateTransition) => {
    const nextState = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const previewDeletion = useCallback(
    (nodeId: string, draftWasDiscarded: boolean) => {
      if (stateRef.current.kind !== 'idle') return;
      transition({ kind: 'previewing', nodeId, draftWasDiscarded });

      void previewNodeDeletion(nodeId)
        .then((impact) => {
          transition(
            impact
              ? awaitingConfirmation({ nodeId, draftWasDiscarded, impact })
              : { kind: 'idle' },
          );
        })
        .catch(() => transition({ kind: 'idle' }));
    },
    [previewNodeDeletion, transition],
  );

  const requestDeletion = useCallback(
    (nodeId: string, { draftWasDiscarded = false }: NodeDeletionRequestOptions = {}) => {
      if (stateRef.current.kind !== 'idle') return;
      if (!draftWasDiscarded && requestEditorDraftDiscard(nodeId)) return;
      previewDeletion(nodeId, draftWasDiscarded);
    },
    [previewDeletion, requestEditorDraftDiscard],
  );

  const cancel = useCallback(() => {
    transition((current) =>
      current.kind === 'awaiting-confirmation' ? { kind: 'idle' } : current,
    );
  }, [transition]);

  const confirmDeletion = useCallback(() => {
    const pending = stateRef.current;
    if (pending.kind !== 'awaiting-confirmation') return;

    const actionId = roadmapConfirmationActionIds.deleteNode;
    transition(revalidating(pending, actionId));

    void (async () => {
      let latestImpact: NodeDeletionImpact | null = null;
      try {
        latestImpact = await previewNodeDeletion(pending.nodeId);
      } catch {
        transition(pending);
        return;
      }

      if (!latestImpact) {
        transition(pending);
        return;
      }

      if (!sameNodeDeletionImpact(pending.impact, latestImpact)) {
        transition(
          awaitingConfirmation({
            nodeId: pending.nodeId,
            draftWasDiscarded: pending.draftWasDiscarded,
            impact: latestImpact,
          }),
        );
        return;
      }

      transition(
        mutating(
          {
            nodeId: pending.nodeId,
            draftWasDiscarded: pending.draftWasDiscarded,
            impact: latestImpact,
          },
          actionId,
        ),
      );

      let deleted = false;
      try {
        deleted = await deleteNode(pending.nodeId, latestImpact.version);
      } catch {
        deleted = false;
      }

      if (deleted) {
        if (!pending.draftWasDiscarded) editorDraftRef.current?.reset();
        closeEditor();
        transition({ kind: 'idle' });
        return;
      }

      let refreshedImpact: NodeDeletionImpact | null = null;
      try {
        refreshedImpact = await previewNodeDeletion(pending.nodeId);
      } catch {
        // Retain the last known authoritative impact when recovery previewing fails.
      }
      transition(
        awaitingConfirmation({
          nodeId: pending.nodeId,
          draftWasDiscarded: pending.draftWasDiscarded,
          impact: refreshedImpact ?? pending.impact,
        }),
      );
    })();
  }, [closeEditor, deleteNode, editorDraftRef, previewNodeDeletion, transition]);

  const handleAction = useCallback(
    (actionId: string) => {
      if (actionId === roadmapConfirmationActionIds.deleteNode) confirmDeletion();
    },
    [confirmDeletion],
  );

  const confirmationState =
    state.kind === 'awaiting-confirmation' ||
    state.kind === 'revalidating' ||
    state.kind === 'mutating'
      ? state
      : null;
  const confirmation = confirmationState
    ? nodeDeletionConfirmation({
        nodeId: confirmationState.nodeId,
        ...confirmationState.impact,
      })
    : null;
  const pendingActionId =
    state.kind === 'revalidating' || state.kind === 'mutating'
      ? roadmapConfirmationActionIds.deleteNode
      : undefined;
  const confirmationDialog: ConfirmationDialogProps = {
    confirmation,
    pendingActionId,
    onCancel: cancel,
    onAction: handleAction,
  };

  return { requestDeletion, confirmationDialog };
}
