'use client';

import { useCallback, useRef, useState } from 'react';
import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';
import {
  roadmapConfirmationActionIds,
  roadmapNodeVisibilityConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { AnyRoadmapDto, NodeHidingImpact } from '@/features/roadmap/types';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

type NodeVisibilityWorkflowRoadmap = Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'>;

type NodeVisibilityRequest = CanvasCommandOf<'hide-node' | 'show-node'>;

type NodeVisibilityConfirmationState = {
  request: NodeVisibilityRequest;
  /** What hiding removes; showing a Node has no Change impact. */
  impact: NodeHidingImpact | null;
};

type NodeVisibilityWorkflowState =
  | { kind: 'idle' }
  | { kind: 'previewing'; request: NodeVisibilityRequest }
  | ({ kind: 'awaiting-confirmation' } & NodeVisibilityConfirmationState)
  | ({ kind: 'mutating' } & NodeVisibilityConfirmationState);

type StateTransition =
  | NodeVisibilityWorkflowState
  | ((state: NodeVisibilityWorkflowState) => NodeVisibilityWorkflowState);

type NodeVisibilityWorkflowOptions = {
  roadmap: NodeVisibilityWorkflowRoadmap | null;
  previewNodeHiding: (nodeId: string) => Promise<NodeHidingImpact | null>;
  setVisibility: (nodeId: string, visible: boolean, previewVersion?: string) => Promise<boolean>;
};

function awaitingConfirmation(
  request: NodeVisibilityRequest,
  impact: NodeHidingImpact | null,
): NodeVisibilityWorkflowState {
  return { kind: 'awaiting-confirmation', request, impact };
}

export function useNodeVisibilityWorkflow({
  roadmap,
  previewNodeHiding,
  setVisibility,
}: NodeVisibilityWorkflowOptions) {
  const [state, setState] = useState<NodeVisibilityWorkflowState>({ kind: 'idle' });
  const stateRef = useRef<NodeVisibilityWorkflowState>({ kind: 'idle' });

  const transition = useCallback((next: StateTransition) => {
    const nextState = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const requestChange = useCallback(
    async (request: NodeVisibilityRequest) => {
      if (stateRef.current.kind !== 'idle') return false;

      if (request.kind === 'show-node') {
        transition(awaitingConfirmation(request, null));
        return false;
      }

      transition({ kind: 'previewing', request });
      try {
        const impact = await previewNodeHiding(request.nodeId);
        transition(impact ? awaitingConfirmation(request, impact) : { kind: 'idle' });
      } catch {
        transition({ kind: 'idle' });
      }
      return false;
    },
    [previewNodeHiding, transition],
  );

  const cancel = useCallback(() => {
    transition((current) =>
      current.kind === 'awaiting-confirmation' ? { kind: 'idle' } : current,
    );
  }, [transition]);

  const confirmChange = useCallback(() => {
    const pending = stateRef.current;
    if (pending.kind !== 'awaiting-confirmation') return;

    transition({ ...pending, kind: 'mutating' });
    void (async () => {
      try {
        const { nodeId, kind } = pending.request;
        const changed = await setVisibility(nodeId, kind === 'show-node', pending.impact?.version);
        transition(changed ? { kind: 'idle' } : pending);
      } catch {
        transition(pending);
      }
    })();
  }, [setVisibility, transition]);

  const handleAction = useCallback(
    (actionId: string) => {
      if (actionId === roadmapConfirmationActionIds.toggleVisibility) confirmChange();
    },
    [confirmChange],
  );

  const confirmationState =
    state.kind === 'awaiting-confirmation' || state.kind === 'mutating' ? state : null;
  const confirmationNode = confirmationState
    ? roadmap?.nodes.find((node) => node.id === confirmationState.request.nodeId)
    : undefined;
  const confirmationDialog: ConfirmationDialogProps = {
    confirmation:
      confirmationState && confirmationNode && roadmap
        ? roadmapNodeVisibilityConfirmation(
            roadmap,
            confirmationNode,
            confirmationState.request.kind === 'hide-node',
            confirmationState.impact?.dependencies ?? [],
          )
        : null,
    pendingActionId:
      state.kind === 'mutating' ? roadmapConfirmationActionIds.toggleVisibility : undefined,
    onCancel: cancel,
    onAction: handleAction,
  };

  return {
    requestChange,
    isPending: state.kind === 'previewing' || state.kind === 'mutating',
    isBusy: state.kind !== 'idle',
    confirmationDialog,
  };
}
