'use client';

import { useCallback, useRef, useState } from 'react';
import {
  roadmapConfirmationActionIds,
  roadmapDependencyConfirmation,
  roadmapDependencyDeletionConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type {
  AnyRoadmapDto,
  RoadmapDependencyRequest,
  TeacherBlockImpact,
} from '@/features/roadmap/types';
import type { ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';

type DependencyCreationState =
  | { kind: 'idle' }
  | { kind: 'previewing'; request: RoadmapDependencyRequest }
  | {
      kind: 'awaiting-confirmation';
      request: RoadmapDependencyRequest;
      affectedNodes: TeacherBlockImpact[];
    }
  | {
      kind: 'creating';
      request: RoadmapDependencyRequest;
      affectedNodes?: TeacherBlockImpact[];
    };

type DependencyDeletionState =
  | { kind: 'idle' }
  | { kind: 'awaiting-confirmation'; dependencyIds: string[] }
  | { kind: 'deleting'; dependencyIds: string[] };

type DependencyStateTransition<State> = State | ((state: State) => State);

type DependencyActionDialog = {
  confirmation: ConfirmationPresentation | null;
  pendingActionId?: string;
  onCancel: () => void;
  onAction: (actionId: string) => void;
};

type DependencyWorkflowRoadmap = Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'>;

type DependencyWorkflowOptions = {
  roadmap: DependencyWorkflowRoadmap | null;
  previewRoadmapDependency: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ) => Promise<TeacherBlockImpact[] | null>;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ) => Promise<boolean>;
  deleteDependency: (dependencyId: string) => Promise<boolean>;
};

export function useDependencyWorkflow({
  roadmap,
  previewRoadmapDependency,
  connectNodes,
  deleteDependency,
}: DependencyWorkflowOptions) {
  const [creationState, setCreationState] = useState<DependencyCreationState>({ kind: 'idle' });
  const creationStateRef = useRef<DependencyCreationState>({ kind: 'idle' });
  const [deletionState, setDeletionState] = useState<DependencyDeletionState>({ kind: 'idle' });
  const deletionStateRef = useRef<DependencyDeletionState>({ kind: 'idle' });

  const transitionCreation = useCallback(
    (next: DependencyStateTransition<DependencyCreationState>) => {
      const nextState = typeof next === 'function' ? next(creationStateRef.current) : next;
      creationStateRef.current = nextState;
      setCreationState(nextState);
    },
    [],
  );

  const transitionDeletion = useCallback(
    (next: DependencyStateTransition<DependencyDeletionState>) => {
      const nextState = typeof next === 'function' ? next(deletionStateRef.current) : next;
      deletionStateRef.current = nextState;
      setDeletionState(nextState);
    },
    [],
  );

  const connectDependency = useCallback(
    (request: RoadmapDependencyRequest) =>
      connectNodes(
        request.sourceNodeId,
        request.targetNodeId,
        request.sourceHandle,
        request.targetHandle,
      ),
    [connectNodes],
  );

  const requestCreation = useCallback(
    (request: RoadmapDependencyRequest) => {
      if (creationStateRef.current.kind !== 'idle') return;
      transitionCreation({ kind: 'previewing', request });

      void (async () => {
        try {
          const affectedNodes = await previewRoadmapDependency(
            request.sourceNodeId,
            request.targetNodeId,
            request.sourceHandle,
            request.targetHandle,
          );
          if (!affectedNodes) {
            transitionCreation({ kind: 'idle' });
            return;
          }

          transitionCreation(
            affectedNodes.length === 0
              ? { kind: 'creating', request }
              : { kind: 'awaiting-confirmation', request, affectedNodes },
          );

          if (affectedNodes.length === 0) {
            try {
              await connectDependency(request);
            } finally {
              transitionCreation({ kind: 'idle' });
            }
          }
        } catch {
          transitionCreation({ kind: 'idle' });
        }
      })();
    },
    [connectDependency, previewRoadmapDependency, transitionCreation],
  );

  const cancelCreation = useCallback(() => {
    transitionCreation((state) => (state.kind === 'creating' ? state : { kind: 'idle' }));
  }, [transitionCreation]);

  const confirmCreation = useCallback(() => {
    const state = creationStateRef.current;
    if (state.kind !== 'awaiting-confirmation') return;
    const { request, affectedNodes } = state;
    transitionCreation({ kind: 'creating', request, affectedNodes });

    void (async () => {
      try {
        const succeeded = await connectDependency(request);
        transitionCreation(succeeded ? { kind: 'idle' } : state);
      } catch {
        transitionCreation(state);
      }
    })();
  }, [connectDependency, transitionCreation]);

  const handleCreationAction = useCallback(
    (actionId: string) => {
      if (actionId === roadmapConfirmationActionIds.createDependency) confirmCreation();
    },
    [confirmCreation],
  );

  const requestDeletion = useCallback(
    (dependencyIds: string[]) => {
      if (dependencyIds.length === 0 || deletionStateRef.current.kind !== 'idle') return;
      transitionDeletion({ kind: 'awaiting-confirmation', dependencyIds: [...dependencyIds] });
    },
    [transitionDeletion],
  );

  const cancelDeletion = useCallback(() => {
    transitionDeletion((state) => (state.kind === 'deleting' ? state : { kind: 'idle' }));
  }, [transitionDeletion]);

  const confirmDeletion = useCallback(() => {
    const state = deletionStateRef.current;
    if (state.kind !== 'awaiting-confirmation') return;
    const dependencyIds = state.dependencyIds;
    transitionDeletion({ kind: 'deleting', dependencyIds });

    void Promise.allSettled(
      dependencyIds.map((dependencyId) => deleteDependency(dependencyId)),
    ).then((results) => {
      const failedDependencyIds = results.flatMap((result, index) =>
        result.status === 'fulfilled' && result.value ? [] : [dependencyIds[index]],
      );
      transitionDeletion(
        failedDependencyIds.length === 0
          ? { kind: 'idle' }
          : { kind: 'awaiting-confirmation', dependencyIds: failedDependencyIds },
      );
    });
  }, [deleteDependency, transitionDeletion]);

  const handleDeletionAction = useCallback(
    (actionId: string) => {
      if (actionId === roadmapConfirmationActionIds.deleteDependencies) confirmDeletion();
    },
    [confirmDeletion],
  );

  const creationRequest =
    creationState.kind === 'awaiting-confirmation' || creationState.kind === 'creating'
      ? creationState.request
      : null;
  const creationAffectedNodes =
    creationState.kind === 'awaiting-confirmation' || creationState.kind === 'creating'
      ? creationState.affectedNodes
      : undefined;
  const creationDialog: DependencyActionDialog = {
    confirmation:
      creationRequest && creationAffectedNodes && roadmap
        ? roadmapDependencyConfirmation({
            roadmap,
            sourceNodeId: creationRequest.sourceNodeId,
            targetNodeId: creationRequest.targetNodeId,
            nodes: creationAffectedNodes,
          })
        : null,
    pendingActionId:
      creationState.kind === 'creating' ? roadmapConfirmationActionIds.createDependency : undefined,
    onCancel: cancelCreation,
    onAction: handleCreationAction,
  };

  const deletionDialog: DependencyActionDialog = {
    confirmation:
      deletionState.kind === 'idle'
        ? null
        : roadmapDependencyDeletionConfirmation(deletionState.dependencyIds),
    pendingActionId:
      deletionState.kind === 'deleting'
        ? roadmapConfirmationActionIds.deleteDependencies
        : undefined,
    onCancel: cancelDeletion,
    onAction: handleDeletionAction,
  };

  return {
    requestCreation,
    requestDeletion,
    creationDialog,
    deletionDialog,
  };
}
