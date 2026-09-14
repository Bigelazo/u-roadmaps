'use client';

import { useCallback, useRef, useState } from 'react';
import type { RoadmapViewport } from '@/features/roadmap/graph/roadmap-graph-projection';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

type CanvasPreviewReturnState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  viewport: RoadmapViewport | null;
};

type CanvasPreviewSessionState =
  | { kind: 'inactive'; restoreViewport: RoadmapViewport | null }
  | { kind: 'active'; returnState: CanvasPreviewReturnState };

type SimulationResetState = 'idle' | 'awaiting-confirmation' | 'resetting';

type CanvasPreviewWorkflowOptions = {
  currentView: Omit<CanvasPreviewReturnState, 'viewport'>;
  isHistorical: boolean;
  requestDraftDiscard: () => boolean;
  loadSimulation: () => Promise<boolean>;
  completeSimulatedNode: (nodeId: string) => Promise<boolean>;
  resetSimulation: () => Promise<boolean>;
  closeActionMenus: () => void;
  onEnter: (discardDraft: boolean) => void;
  onExit: (returnState: Omit<CanvasPreviewReturnState, 'viewport'>) => void;
};

const resetSimulationActionId = 'reset-simulation';

const resetSimulationConfirmation = {
  title: 'Reiniciar progreso de previsualización',
  description:
    'Eliminarás las completaciones simuladas de este Canvas preview. No se eliminarán las Completions estudiantiles. Esta acción no se puede deshacer.',
  intent: 'destructive',
  actions: [{ id: resetSimulationActionId, label: 'Reiniciar progreso' }],
} as const;

export function useCanvasPreviewWorkflow({
  currentView,
  isHistorical,
  requestDraftDiscard,
  loadSimulation,
  completeSimulatedNode,
  resetSimulation,
  closeActionMenus,
  onEnter,
  onExit,
}: CanvasPreviewWorkflowOptions) {
  const [session, setSession] = useState<CanvasPreviewSessionState>({
    kind: 'inactive',
    restoreViewport: null,
  });
  const sessionRef = useRef<CanvasPreviewSessionState>(session);
  const [resetState, setResetState] = useState<SimulationResetState>('idle');
  const resetStateRef = useRef<SimulationResetState>('idle');
  const currentViewRef = useRef(currentView);
  const lastViewportRef = useRef<RoadmapViewport | null>(null);
  const isEntryPendingRef = useRef(false);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);
  currentViewRef.current = currentView;

  const transitionSession = useCallback((next: CanvasPreviewSessionState) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const transitionReset = useCallback((next: SimulationResetState) => {
    resetStateRef.current = next;
    setResetState(next);
  }, []);

  const enter = useCallback(
    async (discardDraft: boolean) => {
      if (isEntryPendingRef.current || sessionRef.current.kind === 'active') return;
      isEntryPendingRef.current = true;
      try {
        const loaded = await loadSimulation();
        if (!loaded) return;

        const returnState = {
          ...currentViewRef.current,
          viewport: lastViewportRef.current,
        };
        closeActionMenus();
        transitionSession({ kind: 'active', returnState });
        onEnter(discardDraft);
      } catch {
        // useRoadmap reports the failure; leaving the session inactive makes retrying possible.
      } finally {
        isEntryPendingRef.current = false;
      }
    },
    [closeActionMenus, loadSimulation, onEnter, transitionSession],
  );

  const requestEntry = useCallback(() => {
    if (requestDraftDiscard()) return;
    void enter(false);
  }, [enter, requestDraftDiscard]);

  const resumeEntryAfterDraftDiscard = useCallback(() => {
    void enter(true);
  }, [enter]);

  const exit = useCallback(() => {
    const activeSession = sessionRef.current;
    if (activeSession.kind !== 'active') return;

    const { viewport, ...returnView } = activeSession.returnState;
    transitionReset('idle');
    transitionSession({ kind: 'inactive', restoreViewport: viewport });
    onExit(returnView);
    requestAnimationFrame(() => entryButtonRef.current?.focus());
  }, [onExit, transitionReset, transitionSession]);

  const onViewportChange = useCallback((viewport: RoadmapViewport) => {
    lastViewportRef.current = viewport;
  }, []);

  const requestReset = useCallback(() => {
    if (sessionRef.current.kind !== 'active' || isHistorical) return;
    transitionReset('awaiting-confirmation');
  }, [isHistorical, transitionReset]);

  const cancelReset = useCallback(() => {
    if (resetStateRef.current === 'resetting') return;
    transitionReset('idle');
  }, [transitionReset]);

  const handleResetAction = useCallback(
    (actionId: string) => {
      if (actionId !== resetSimulationActionId || resetStateRef.current !== 'awaiting-confirmation')
        return;

      transitionReset('resetting');
      void (async () => {
        try {
          const succeeded = await resetSimulation();
          transitionReset(succeeded ? 'idle' : 'awaiting-confirmation');
        } catch {
          transitionReset('awaiting-confirmation');
        }
      })();
    },
    [resetSimulation, transitionReset],
  );

  const completeNode = useCallback(
    (nodeId: string) => {
      if (sessionRef.current.kind !== 'active') return false;
      if (!isHistorical) void completeSimulatedNode(nodeId);
      return true;
    },
    [completeSimulatedNode, isHistorical],
  );

  const confirmationDialog: ConfirmationDialogProps = {
    confirmation: resetState === 'idle' ? null : resetSimulationConfirmation,
    pendingActionId: resetState === 'resetting' ? resetSimulationActionId : undefined,
    onCancel: cancelReset,
    onAction: handleResetAction,
  };

  return {
    isActive: session.kind === 'active',
    restoreViewport: session.kind === 'inactive' ? session.restoreViewport : null,
    entryButtonRef,
    requestEntry,
    resumeEntryAfterDraftDiscard,
    exit,
    onViewportChange,
    requestReset,
    completeNode,
    confirmationDialog,
  };
}
