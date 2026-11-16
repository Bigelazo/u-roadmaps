'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import type { CanvasMode } from './mode';
import type { CanvasState, CanvasStateAction } from './state';
import type { NodeEditorCommand, NodeEditorGuardReason } from '@/features/roadmap/editor/types';
import { isStudentBlockedNode } from '@/features/roadmap/student/node-status';
import type { CanvasCommand } from './commands/canvas-command';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import type { RoadmapNodeDto, StudentAccessibleRoadmapNode } from '@/features/roadmap/types';

export type NodeSelectionPanel =
  | { kind: 'closed' }
  | { kind: 'editor'; resourceComposerCommand?: NodeEditorCommand }
  | { kind: 'student-detail' }
  | {
      kind: 'node-information-preview';
      node: StudentAccessibleRoadmapNode;
      isCompleted: boolean;
      focusReturn: () => void;
    };

export type NodeSelectionNotice = 'selected-node-blocked' | 'selected-node-removed';

export type NodeSelectionFocusReturn = { token: string; destination: 'node' | 'canvas' };

export type NodeSelectionOptions = {
  canvas: { state: CanvasState; dispatch: Dispatch<CanvasStateAction> };
  nodes: readonly RoadmapNodeDto[] | undefined;
  mode: CanvasMode;
  guardDraft: (reason: NodeEditorGuardReason) => Promise<boolean>;
  hasDraft: () => boolean;
  reportPracticeAction?: (action: PracticeCanvasAction) => void;
};

function panelOf(state: CanvasState): NodeSelectionPanel {
  if (state.teacherPreviewNode) {
    return {
      kind: 'node-information-preview',
      node: state.teacherPreviewNode,
      isCompleted: state.isTeacherPreviewCompleted,
      focusReturn: state.teacherPreviewFocusReturn ?? (() => {}),
    };
  }
  if (state.isEditorOpen) {
    return state.resourceComposerCommand
      ? { kind: 'editor', resourceComposerCommand: state.resourceComposerCommand }
      : { kind: 'editor' };
  }
  if (state.isStudentDetailOpen) return { kind: 'student-detail' };
  return { kind: 'closed' };
}

function useFocusReturn() {
  const [focusReturn, setFocusReturn] = useState<NodeSelectionFocusReturn | null>(null);
  const nextTokenRef = useRef(0);
  const requestFocusReturn = useCallback((destination: NodeSelectionFocusReturn['destination']) => {
    setFocusReturn({ token: `node-selection-focus-${++nextTokenRef.current}`, destination });
  }, []);
  return { focusReturn, requestFocusReturn };
}

export function useNodeSelection({
  canvas: { state, dispatch },
  nodes,
  mode,
  guardDraft,
  hasDraft,
  reportPracticeAction,
}: NodeSelectionOptions) {
  const { isStudentExperience, isEditing } = mode;
  const { canEditRoadmap } = mode.capabilities;
  const { selectedNodeId } = state;
  const { focusReturn, requestFocusReturn } = useFocusReturn();
  const [notice, setNotice] = useState<NodeSelectionNotice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const hasDraftRef = useRef(hasDraft);
  useEffect(() => {
    hasDraftRef.current = hasDraft;
  });

  useEffect(() => {
    if (!selectedNodeId || !nodes) return;
    const selected = nodes.find((node) => node.id === selectedNodeId);
    const blocked = isStudentExperience && isStudentBlockedNode(selected);
    if (selected && !blocked) return;
    if (blocked && !state.isStudentDetailOpen) return;
    dispatch({
      type: 'reconcileSelection',
      removed: !selected,
      preserveEditorDraft: canEditRoadmap && hasDraftRef.current(),
    });
    setNotice(selected ? 'selected-node-blocked' : 'selected-node-removed');
    requestFocusReturn(selected ? 'node' : 'canvas');
  }, [
    canEditRoadmap,
    dispatch,
    isStudentExperience,
    nodes,
    requestFocusReturn,
    selectedNodeId,
    state.isStudentDetailOpen,
  ]);

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = nodes?.find((candidate) => candidate.id === nodeId);
      if (isStudentExperience && isStudentBlockedNode(node)) return;
      const select = () => {
        dismissNotice();
        reportPracticeAction?.({ type: 'selectNode', nodeId });
        dispatch({
          type: 'selectNode',
          nodeId,
          panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
        });
      };
      if (isEditing && selectedNodeId && selectedNodeId !== nodeId) {
        return guardDraft({ kind: 'replace-node', nodeId }).then((proceed) => {
          if (proceed) select();
        });
      }
      select();
    },
    [
      canEditRoadmap,
      dismissNotice,
      dispatch,
      guardDraft,
      isEditing,
      isStudentExperience,
      nodes,
      reportPracticeAction,
      selectedNodeId,
    ],
  );

  const closeSelectedNodeNow = useCallback(() => {
    dispatch({ type: 'closeSelectedNode', panel: isStudentExperience ? 'student' : 'editor' });
    requestFocusReturn('node');
  }, [dispatch, isStudentExperience, requestFocusReturn]);

  const closeSelectedNode = useCallback(
    (options: { guardDraft?: boolean } = {}) => {
      if (options.guardDraft !== false && isEditing && selectedNodeId) {
        return guardDraft({ kind: 'deselect-node', nodeId: selectedNodeId }).then((proceed) => {
          if (proceed) closeSelectedNodeNow();
        });
      }
      closeSelectedNodeNow();
    },
    [closeSelectedNodeNow, guardDraft, isEditing, selectedNodeId],
  );

  const openEditor = useCallback(
    (nodeId: string) => dispatch({ type: 'selectNode', nodeId, panel: 'editor' }),
    [dispatch],
  );

  const openResourceComposer = useCallback(
    (nodeId: string) => {
      if (!isEditing) return;
      return guardDraft({ kind: 'open-resource', nodeId }).then((proceed) => {
        if (!proceed) return;
        dispatch({
          type: 'openResourceComposer',
          command: { id: crypto.randomUUID(), kind: 'open-resource', nodeId, mode: 'file' },
        });
      });
    },
    [dispatch, guardDraft, isEditing],
  );

  const followAppliedCommand = useCallback(
    (command: CanvasCommand, createdNodeId?: string) => {
      if (command.kind === 'add-node' && createdNodeId) {
        dispatch({ type: 'selectCreatedNode', nodeId: createdNodeId });
      } else if (command.kind === 'delete-node') {
        closeSelectedNode({ guardDraft: false });
      }
    },
    [closeSelectedNode, dispatch],
  );

  const closeNodeInformationPreview = useCallback(() => {
    const focusReturn = state.teacherPreviewFocusReturn;
    dispatch({ type: 'closeTeacherPreview' });
    requestAnimationFrame(() => focusReturn?.());
  }, [dispatch, state.teacherPreviewFocusReturn]);

  const showNodeInformationPreview = useCallback(
    (node: StudentAccessibleRoadmapNode, focusReturn: () => void) =>
      dispatch({ type: 'showTeacherPreview', node, focusReturn }),
    [dispatch],
  );

  const completeNodeInformationPreview = useCallback(
    () => dispatch({ type: 'completeTeacherPreview' }),
    [dispatch],
  );

  const dismissTopmostPanel = useCallback(() => {
    if (!canEditRoadmap) return false;
    if (state.teacherPreviewNode) {
      closeNodeInformationPreview();
      return true;
    }
    if (state.isEditorOpen && isEditing) {
      dispatch({ type: 'closeEditor' });
      return true;
    }
    return false;
  }, [
    canEditRoadmap,
    closeNodeInformationPreview,
    dispatch,
    isEditing,
    state.isEditorOpen,
    state.teacherPreviewNode,
  ]);

  return {
    selectedNodeId,
    panel: panelOf(state),
    notice,
    focusReturn,
    selectNode,
    closeSelectedNode,
    dismissTopmostPanel,
    openEditor,
    openResourceComposer,
    followAppliedCommand,
    showNodeInformationPreview,
    completeNodeInformationPreview,
    closeNodeInformationPreview,
    dismissNotice,
  };
}
