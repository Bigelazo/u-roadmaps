'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  RoadmapViewport,
  RoadmapViewportRestoration,
} from '@/features/roadmap/graph/roadmap-graph-projection';

type CanvasPreviewState =
  | { kind: 'inactive'; viewportRestoration: RoadmapViewportRestoration | null }
  | { kind: 'active'; returnViewport: RoadmapViewport | null };

type CanvasPreviewWorkflowOptions = {
  isHistorical: boolean;
  guardDraft: () => Promise<boolean>;
  loadCanvasPreview: () => Promise<boolean>;
  completeCanvasPreviewNode: (nodeId: string) => Promise<boolean>;
  onEnter: () => void;
};

export function useCanvasPreviewWorkflow({
  isHistorical,
  guardDraft,
  loadCanvasPreview,
  completeCanvasPreviewNode,
  onEnter,
}: CanvasPreviewWorkflowOptions) {
  const [state, setState] = useState<CanvasPreviewState>({
    kind: 'inactive',
    viewportRestoration: null,
  });
  const lastViewportRef = useRef<RoadmapViewport | null>(null);
  const viewportRestorationTokenRef = useRef(0);
  const isEntryPendingRef = useRef(false);
  const entryButtonRef = useRef<HTMLButtonElement | null>(null);

  const enter = useCallback(async () => {
    if (isEntryPendingRef.current || state.kind === 'active') return;
    isEntryPendingRef.current = true;
    try {
      if (!(await guardDraft())) return;
      const loaded = await loadCanvasPreview();
      if (!loaded) return;

      setState((current) =>
        current.kind === 'active'
          ? current
          : { kind: 'active', returnViewport: lastViewportRef.current },
      );
      onEnter();
      // eslint-disable-next-line no-empty -- The session reports the failure; leaving it inactive makes retrying possible.
    } catch {
    } finally {
      isEntryPendingRef.current = false;
    }
  }, [guardDraft, loadCanvasPreview, onEnter, state.kind]);

  const requestEntry = useCallback(() => {
    void enter();
  }, [enter]);

  const exit = useCallback(() => {
    if (state.kind !== 'active') return;
    const { returnViewport } = state;
    const token = `canvas-preview-return-${++viewportRestorationTokenRef.current}`;
    setState({
      kind: 'inactive',
      viewportRestoration: returnViewport ? { token, viewport: returnViewport } : null,
    });
    requestAnimationFrame(() => entryButtonRef.current?.focus());
  }, [state]);

  const onViewportChange = useCallback(
    (viewport: RoadmapViewport) => {
      if (state.kind === 'active') return;
      lastViewportRef.current = viewport;
    },
    [state.kind],
  );

  const completeNode = useCallback(
    (nodeId: string) => {
      if (state.kind !== 'active') return false;
      if (!isHistorical) void completeCanvasPreviewNode(nodeId);
      return true;
    },
    [completeCanvasPreviewNode, isHistorical, state.kind],
  );

  return {
    isActive: state.kind === 'active',
    viewportRestoration: state.kind === 'inactive' ? state.viewportRestoration : null,
    entryButtonRef,
    requestEntry,
    exit,
    onViewportChange,
    completeNode,
  };
}
