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

type DependencyActionDialog = {
  confirmation: ConfirmationPresentation | null;
  pendingActionId?: string;
  onCancel: () => void;
  onAction: (actionId: string) => void;
};

export type RoadmapDependencyWorkflow = {
  requestCreation: (request: RoadmapDependencyRequest) => void;
  requestDeletion: (dependencyIds: string[]) => void;
  isBusy: boolean;
  creationDialog: DependencyActionDialog;
  deletionDialog: DependencyActionDialog;
};

type DependencyWorkflowOptions = {
  roadmap: Pick<AnyRoadmapDto, 'nodes' | 'nodeTypes'> | null;
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
    async (request: RoadmapDependencyRequest) => {
      const succeeded = await connectNodes(
        request.sourceNodeId,
        request.targetNodeId,
        request.sourceHandle,
        request.targetHandle,
      );
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
        if (affectedNodes.length > 0) {
          transitionCreation({ kind: 'awaiting-confirmation', request, affectedNodes });
          return;
        }
        transitionCreation({ kind: 'creating', request });
        try {
          await create(request);
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
    transitionCreation({
      kind: 'creating',
      request: state.request,
      affectedNodes: state.affectedNodes,
    });
    void create(state.request).then(
      (succeeded) => transitionCreation(succeeded ? { kind: 'idle' } : state),
      () => transitionCreation(state),
    );
  }, [create, transitionCreation]);

  const requestDeletion = useCallback(
    (dependencyIds: string[]) => {
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

  const creationRequest =
    creationState.kind === 'awaiting-confirmation' || creationState.kind === 'creating'
      ? creationState.request
      : null;
  const creationAffectedNodes =
    creationState.kind === 'awaiting-confirmation' || creationState.kind === 'creating'
      ? creationState.affectedNodes
      : undefined;

  return {
    requestCreation,
    requestDeletion,
    isBusy: creationState.kind !== 'idle' || deletionState.kind !== 'idle',
    creationDialog: {
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
