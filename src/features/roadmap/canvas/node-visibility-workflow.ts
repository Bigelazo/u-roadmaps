'use client';

import { useCallback, useRef, useState } from 'react';
import {
  roadmapConfirmationActionIds,
  roadmapNodeVisibilityConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type { AnyRoadmapDto } from '@/features/roadmap/types';
import type { StructuralDependency } from '@/features/roadmap/useRoadmap';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

type NodeVisibilityWorkflowRoadmap = Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'>;

type NodeVisibilityRequest = {
  nodeId: string;
  currentlyVisible: boolean;
};

type NodeVisibilityConfirmationState = NodeVisibilityRequest & {
  dependencies: StructuralDependency[];
};

type NodeVisibilityWorkflowState =
  | { kind: 'idle' }
  | ({ kind: 'previewing' } & NodeVisibilityRequest)
  | ({ kind: 'awaiting-confirmation' } & NodeVisibilityConfirmationState)
  | ({ kind: 'mutating' } & NodeVisibilityConfirmationState);

type StateTransition =
  | NodeVisibilityWorkflowState
  | ((state: NodeVisibilityWorkflowState) => NodeVisibilityWorkflowState);

type NodeVisibilityWorkflowOptions = {
  roadmap: NodeVisibilityWorkflowRoadmap | null;
  previewNodeVisibility: (nodeId: string) => Promise<StructuralDependency[] | null>;
  toggleVisibility: (nodeId: string, currentlyVisible: boolean) => Promise<boolean>;
};

function awaitingConfirmation(
  request: NodeVisibilityRequest,
  dependencies: StructuralDependency[],
): NodeVisibilityWorkflowState {
  return { kind: 'awaiting-confirmation', ...request, dependencies };
}

export function useNodeVisibilityWorkflow({
  roadmap,
  previewNodeVisibility,
  toggleVisibility,
}: NodeVisibilityWorkflowOptions) {
  const [state, setState] = useState<NodeVisibilityWorkflowState>({ kind: 'idle' });
  const stateRef = useRef<NodeVisibilityWorkflowState>({ kind: 'idle' });

  const transition = useCallback((next: StateTransition) => {
    const nextState = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const requestChange = useCallback(
    async (nodeId: string, currentlyVisible: boolean) => {
      if (stateRef.current.kind !== 'idle') return false;

      const request = { nodeId, currentlyVisible };
      if (!currentlyVisible) {
        transition(awaitingConfirmation(request, []));
        return false;
      }

      transition({ kind: 'previewing', ...request });
      try {
        const dependencies = await previewNodeVisibility(nodeId);
        transition(dependencies ? awaitingConfirmation(request, dependencies) : { kind: 'idle' });
      } catch {
        transition({ kind: 'idle' });
      }
      return false;
    },
    [previewNodeVisibility, transition],
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
        const changed = await toggleVisibility(pending.nodeId, pending.currentlyVisible);
        transition(changed ? { kind: 'idle' } : pending);
      } catch {
        transition(pending);
      }
    })();
  }, [toggleVisibility, transition]);

  const handleAction = useCallback(
    (actionId: string) => {
      if (actionId === roadmapConfirmationActionIds.toggleVisibility) confirmChange();
    },
    [confirmChange],
  );

  const confirmationState =
    state.kind === 'awaiting-confirmation' || state.kind === 'mutating' ? state : null;
  const confirmationNode = confirmationState
    ? roadmap?.nodes.find((node) => node.id === confirmationState.nodeId)
    : undefined;
  const confirmationDialog: ConfirmationDialogProps = {
    confirmation:
      confirmationState && confirmationNode && roadmap
        ? roadmapNodeVisibilityConfirmation(
            roadmap,
            confirmationNode,
            confirmationState.currentlyVisible,
            confirmationState.dependencies,
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
