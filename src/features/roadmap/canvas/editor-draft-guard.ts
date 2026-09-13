'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import {
  editorDraftDiscardConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';
import type {
  EditorDraftDiscardDestination,
  RoadmapEditorDraftHandle,
} from '@/features/roadmap/editor/types';
import type { ConfirmationDialogProps } from '@/shared/ui/confirmation-dialog';

type EditorDraftGuardState =
  { kind: 'idle' } | { kind: 'awaiting-confirmation'; destination: EditorDraftDiscardDestination };

type EditorDraftGuardOptions = {
  draftRef: RefObject<RoadmapEditorDraftHandle | null>;
  onDiscard: (destination: EditorDraftDiscardDestination) => void;
};

function requiresDiscard(
  draft: RoadmapEditorDraftHandle | null,
  destination: EditorDraftDiscardDestination,
) {
  if (!draft?.isDirty) return false;

  switch (destination.kind) {
    case 'discardNodeDraft':
      return draft.draftNodeId === destination.nodeId;
    case 'discardResourceDraft':
      return draft.draftNodeId !== destination.nodeId;
    case 'discardCanvasPreviewDraft':
      return true;
  }
}

export function useEditorDraftGuard({ draftRef, onDiscard }: EditorDraftGuardOptions) {
  const [state, setState] = useState<EditorDraftGuardState>({ kind: 'idle' });
  const stateRef = useRef<EditorDraftGuardState>({ kind: 'idle' });

  const transition = useCallback((next: EditorDraftGuardState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const request = useCallback(
    (destination: EditorDraftDiscardDestination) => {
      if (stateRef.current.kind !== 'idle') return true;
      if (!requiresDiscard(draftRef.current, destination)) return false;

      transition({ kind: 'awaiting-confirmation', destination });
      return true;
    },
    [draftRef, transition],
  );

  const cancel = useCallback(() => {
    transition({ kind: 'idle' });
  }, [transition]);

  const discard = useCallback(
    (actionId: string) => {
      const pending = stateRef.current;
      if (
        pending.kind !== 'awaiting-confirmation' ||
        actionId !== roadmapConfirmationActionIds.discardEditorDraft
      )
        return;

      transition({ kind: 'idle' });
      draftRef.current?.reset();
      onDiscard(pending.destination);
    },
    [draftRef, onDiscard, transition],
  );

  const confirmationDialog: ConfirmationDialogProps = {
    confirmation:
      state.kind === 'awaiting-confirmation'
        ? editorDraftDiscardConfirmation(state.destination)
        : null,
    onCancel: cancel,
    onAction: discard,
  };

  return { request, confirmationDialog };
}
