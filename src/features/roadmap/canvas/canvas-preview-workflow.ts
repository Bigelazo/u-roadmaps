'use client';

import { useCallback, useRef, type Dispatch } from 'react';
import type { RoadmapViewport } from '@/features/roadmap/graph/roadmap-graph-projection';
import type { CanvasState, CanvasStateAction } from './state';

type CanvasPreviewWorkflowOptions = {
  canvas: { state: CanvasState; dispatch: Dispatch<CanvasStateAction> };
  isHistorical: boolean;
  guardDraft: () => Promise<boolean>;
  loadCanvasPreview: () => Promise<boolean>;
  completeCanvasPreviewNode: (nodeId: string) => Promise<boolean>;
  onEnter: () => void;
};

export function useCanvasPreviewWorkflow({
  canvas: { state, dispatch },
  isHistorical,
  guardDraft,
  loadCanvasPreview,
  completeCanvasPreviewNode,
  onEnter,
}: CanvasPreviewWorkflowOptions) {
  const lastViewportRef = useRef<RoadmapViewport | null>(null);
  const viewportRestorationTokenRef = useRef(0);
  const isEntryPendingRef = useRef(false);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);

  const enter = useCallback(async () => {
    if (isEntryPendingRef.current || state.canvasPreview.kind === 'active') return;
    isEntryPendingRef.current = true;
    try {
      if (!(await guardDraft())) return;
      const loaded = await loadCanvasPreview();
      if (!loaded) return;

      dispatch({ type: 'enterCanvasPreview', viewport: lastViewportRef.current });
      onEnter();
      // eslint-disable-next-line no-empty -- The session reports the failure; leaving it inactive makes retrying possible.
    } catch {
    } finally {
      isEntryPendingRef.current = false;
    }
  }, [dispatch, guardDraft, loadCanvasPreview, onEnter, state.canvasPreview.kind]);

  const requestEntry = useCallback(() => {
    void enter();
  }, [enter]);

  const exit = useCallback(() => {
    if (state.canvasPreview.kind !== 'active') return;
    dispatch({
      type: 'exitCanvasPreview',
      viewportToken: `canvas-preview-return-${++viewportRestorationTokenRef.current}`,
    });
    requestAnimationFrame(() => entryButtonRef.current?.focus());
  }, [dispatch, state.canvasPreview.kind]);

  const onViewportChange = useCallback(
    (viewport: RoadmapViewport) => {
      if (state.canvasPreview.kind === 'active') return;
      lastViewportRef.current = viewport;
    },
    [state.canvasPreview.kind],
  );

  const completeNode = useCallback(
    (nodeId: string) => {
      if (state.canvasPreview.kind !== 'active') return false;
      if (!isHistorical) void completeCanvasPreviewNode(nodeId);
      return true;
    },
    [completeCanvasPreviewNode, isHistorical, state.canvasPreview.kind],
  );

  return {
    isActive: state.canvasPreview.kind === 'active',
    viewportRestoration:
      state.canvasPreview.kind === 'inactive' ? state.canvasPreview.viewportRestoration : null,
    entryButtonRef,
    requestEntry,
    exit,
    onViewportChange,
    completeNode,
  };
}
