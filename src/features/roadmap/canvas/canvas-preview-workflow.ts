'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type {
  RoadmapViewport,
  RoadmapViewportRestoration,
} from '@/features/roadmap/graph/roadmap-graph-projection';

type CanvasPreviewReturnState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  viewport: RoadmapViewport | null;
};

type CanvasPreviewSessionState =
  | { kind: 'inactive'; viewportRestoration: RoadmapViewportRestoration | null }
  | { kind: 'active'; returnState: CanvasPreviewReturnState };

type CanvasPreviewWorkflowOptions = {
  currentView: Omit<CanvasPreviewReturnState, 'viewport'>;
  isHistorical: boolean;
  guardDraft: () => Promise<boolean>;
  loadSimulation: () => Promise<boolean>;
  completeSimulatedNode: (nodeId: string) => Promise<boolean>;
  onEnter: () => void;
  onExit: (returnState: Omit<CanvasPreviewReturnState, 'viewport'>) => void;
};

export function useCanvasPreviewWorkflow({
  currentView,
  isHistorical,
  guardDraft,
  loadSimulation,
  completeSimulatedNode,
  onEnter,
  onExit,
}: CanvasPreviewWorkflowOptions) {
  const [session, setSession] = useState<CanvasPreviewSessionState>({
    kind: 'inactive',
    viewportRestoration: null,
  });
  const sessionRef = useRef<CanvasPreviewSessionState>(session);
  const currentViewRef = useRef(currentView);
  const lastViewportRef = useRef<RoadmapViewport | null>(null);
  const viewportRestorationTokenRef = useRef(0);
  const isEntryPendingRef = useRef(false);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const transitionSession = useCallback((next: CanvasPreviewSessionState) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const enter = useCallback(async () => {
    if (isEntryPendingRef.current || sessionRef.current.kind === 'active') return;
    isEntryPendingRef.current = true;
    try {
      const loaded = await loadSimulation();
      if (!loaded) return;

      const returnState = {
        ...currentViewRef.current,
        viewport: lastViewportRef.current,
      };
      transitionSession({ kind: 'active', returnState });
      onEnter();
    } catch {
      // The session reports the failure; leaving it inactive makes retrying possible.
    } finally {
      isEntryPendingRef.current = false;
    }
  }, [loadSimulation, onEnter, transitionSession]);

  const requestEntry = useCallback(() => {
    void guardDraft().then((proceed) => {
      if (proceed) void enter();
    });
  }, [enter, guardDraft]);

  const exit = useCallback(() => {
    const activeSession = sessionRef.current;
    if (activeSession.kind !== 'active') return;

    const { viewport, ...returnView } = activeSession.returnState;
    transitionSession({
      kind: 'inactive',
      viewportRestoration: viewport
        ? {
            token: `canvas-preview-return-${++viewportRestorationTokenRef.current}`,
            viewport,
          }
        : null,
    });
    onExit(returnView);
    requestAnimationFrame(() => entryButtonRef.current?.focus());
  }, [onExit, transitionSession]);

  const onViewportChange = useCallback((viewport: RoadmapViewport) => {
    if (sessionRef.current.kind === 'active') return;
    lastViewportRef.current = viewport;
  }, []);

  const completeNode = useCallback(
    (nodeId: string) => {
      if (sessionRef.current.kind !== 'active') return false;
      if (!isHistorical) void completeSimulatedNode(nodeId);
      return true;
    },
    [completeSimulatedNode, isHistorical],
  );

  return {
    isActive: session.kind === 'active',
    viewportRestoration: session.kind === 'inactive' ? session.viewportRestoration : null,
    entryButtonRef,
    requestEntry,
    exit,
    onViewportChange,
    completeNode,
  };
}
