'use client';

import { useCallback, useRef, useState } from 'react';
import { roadmapConfirmationActionIds } from '@/features/roadmap/canvas/commands/commands';
import {
  roadmapDependencyConfirmation,
  roadmapDependencyDeletionConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type {
  AnyRoadmapDto,
  DependencyImpact,
  RoadmapDependencyRequest,
} from '@/features/roadmap/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

type DependencyCreationState =
  | { kind: 'idle' }
  | { kind: 'previewing'; request: RoadmapDependencyRequest }
  | { kind: 'awaiting-confirmation'; request: RoadmapDependencyRequest; impact: DependencyImpact }
  | { kind: 'creating'; request: RoadmapDependencyRequest; impact: DependencyImpact };

type DependencyDeletionState =
  | { kind: 'idle' }
  | { kind: 'awaiting-confirmation'; dependencyIds: string[] }
  | { kind: 'deleting'; dependencyIds: string[] };

type DependencyActionDialog = {
  confirmation: ConfirmationPresentation | null;
  pendingActionId?: string;
  onCancel: () => void;
  onAction: (actionId: string) => void;
};

export type RoadmapDependencyWorkflow = {
  requestCreation: (request: RoadmapDependencyRequest) => void;
  requestDeletion: (dependencyIds: readonly string[]) => void;
  isBusy: boolean;
  creationDialog: DependencyActionDialog;
  deletionDialog: DependencyActionDialog;
};

type DependencyWorkflowOptions = {
  roadmap: Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'> | null;
  previewRoadmapDependency: (
    dependency: RoadmapDependencyRequest,
  ) => Promise<DependencyImpact | null>;
  connectNodes: (dependency: RoadmapDependencyRequest, previewVersion?: string) => Promise<boolean>;
  deleteDependency: (dependencyId: string) => Promise<boolean>;
  onCreationSuccess: () => void;
  onDeletionSuccess: (deletedCount: number) => void;
};

/** The canvas session owns Dependency pending state, confirmation, and outcomes. */
export function useRoadmapDependencyWorkflow({
  roadmap,
  previewRoadmapDependency,
  connectNodes,
  deleteDependency,
  onCreationSuccess,
  onDeletionSuccess,
}: DependencyWorkflowOptions): RoadmapDependencyWorkflow {
  const [creationState, setCreationState] = useState<DependencyCreationState>({ kind: 'idle' });
  const creationStateRef = useRef<DependencyCreationState>({ kind: 'idle' });
  const [deletionState, setDeletionState] = useState<DependencyDeletionState>({ kind: 'idle' });
  const deletionStateRef = useRef<DependencyDeletionState>({ kind: 'idle' });

  const transitionCreation = useCallback((next: DependencyCreationState) => {
    creationStateRef.current = next;
    setCreationState(next);
  }, []);
  const transitionDeletion = useCallback((next: DependencyDeletionState) => {
    deletionStateRef.current = next;
    setDeletionState(next);
  }, []);

  const create = useCallback(
    async (request: RoadmapDependencyRequest, impact: DependencyImpact) => {
      const succeeded = await connectNodes(request, impact.version);
      if (succeeded) onCreationSuccess();
      return succeeded;
    },
    [connectNodes, onCreationSuccess],
  );

  const requestCreation = useCallback(
    (request: RoadmapDependencyRequest) => {
      if (creationStateRef.current.kind !== 'idle') return;
      transitionCreation({ kind: 'previewing', request });
      void (async () => {
        const impact = await previewRoadmapDependency(request);
        if (!impact) {
          transitionCreation({ kind: 'idle' });
          return;
        }
        if (impact.nodes.length > 0) {
          transitionCreation({ kind: 'awaiting-confirmation', request, impact });
          return;
        }
        transitionCreation({ kind: 'creating', request, impact });
        try {
          await create(request, impact);
        } finally {
          transitionCreation({ kind: 'idle' });
        }
      })();
    },
    [create, previewRoadmapDependency, transitionCreation],
  );

  const confirmCreation = useCallback(() => {
    const state = creationStateRef.current;
    if (state.kind !== 'awaiting-confirmation') return;
    transitionCreation({ ...state, kind: 'creating' });
    void create(state.request, state.impact).then(
      (succeeded) => transitionCreation(succeeded ? { kind: 'idle' } : state),
      () => transitionCreation(state),
    );
  }, [create, transitionCreation]);

  const requestDeletion = useCallback(
    (dependencyIds: readonly string[]) => {
      if (dependencyIds.length === 0 || deletionStateRef.current.kind !== 'idle') return;
      transitionDeletion({ kind: 'awaiting-confirmation', dependencyIds: [...dependencyIds] });
    },
    [transitionDeletion],
  );

  const confirmDeletion = useCallback(() => {
    const state = deletionStateRef.current;
    if (state.kind !== 'awaiting-confirmation') return;
    transitionDeletion({ kind: 'deleting', dependencyIds: state.dependencyIds });
    void Promise.allSettled(state.dependencyIds.map(deleteDependency)).then((results) => {
      const failedDependencyIds = results.flatMap((result, index) =>
        result.status === 'fulfilled' && result.value ? [] : [state.dependencyIds[index]],
      );
      const deletedCount = state.dependencyIds.length - failedDependencyIds.length;
      if (deletedCount > 0) onDeletionSuccess(deletedCount);
      transitionDeletion(
        failedDependencyIds.length === 0
          ? { kind: 'idle' }
          : { kind: 'awaiting-confirmation', dependencyIds: failedDependencyIds },
      );
    });
  }, [deleteDependency, onDeletionSuccess, transitionDeletion]);

  // Only a creation with impact is confirmed, so only it shows its dialog while creating.
  const creationConfirmation =
    creationState.kind !== 'idle' &&
    creationState.kind !== 'previewing' &&
    creationState.impact.nodes.length > 0
      ? creationState
      : null;

  return {
    requestCreation,
    requestDeletion,
    isBusy: creationState.kind !== 'idle' || deletionState.kind !== 'idle',
    creationDialog: {
      confirmation:
        creationConfirmation && roadmap
          ? roadmapDependencyConfirmation({
              roadmap,
              sourceNodeId: creationConfirmation.request.sourceNodeId,
              targetNodeId: creationConfirmation.request.targetNodeId,
              nodes: creationConfirmation.impact.nodes,
            })
          : null,
      pendingActionId:
        creationState.kind === 'creating'
          ? roadmapConfirmationActionIds.createDependency
          : undefined,
      onCancel: () => {
        if (creationStateRef.current.kind !== 'creating') transitionCreation({ kind: 'idle' });
      },
      onAction: (actionId) => {
        if (actionId === roadmapConfirmationActionIds.createDependency) confirmCreation();
      },
    },
    deletionDialog: {
      confirmation:
        deletionState.kind === 'idle'
          ? null
          : roadmapDependencyDeletionConfirmation(deletionState.dependencyIds),
      pendingActionId:
        deletionState.kind === 'deleting'
          ? roadmapConfirmationActionIds.deleteDependencies
          : undefined,
      onCancel: () => {
        if (deletionStateRef.current.kind !== 'deleting') transitionDeletion({ kind: 'idle' });
      },
      onAction: (actionId) => {
        if (actionId === roadmapConfirmationActionIds.deleteDependencies) confirmDeletion();
      },
    },
  };
}
