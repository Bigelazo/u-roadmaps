'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CanvasMode } from './mode';
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
  nodes: readonly RoadmapNodeDto[] | undefined;
  mode: CanvasMode;
  guardDraft: (reason: NodeEditorGuardReason) => Promise<boolean>;
  hasDraft: () => boolean;
  reportPracticeAction?: (action: PracticeCanvasAction) => void;
};

type RestorablePanel = { kind: 'closed' } | { kind: 'editor' } | { kind: 'student-detail' };

type NodeSelectionState = {
  selectedNodeId: string | null;
  panel: NodeSelectionPanel;
  isCanvasPreview: boolean;
  canvasPreviewReturn: { selectedNodeId: string | null; panel: RestorablePanel } | null;
};

type NodeSelectionAction =
  | { type: 'closeEditor' }
  | { type: 'reconcileSelection'; removed: boolean; preserveEditorDraft?: boolean }
  | { type: 'closeSelectedNode' }
  | { type: 'closeNodeInformationPreview' }
  | { type: 'observeCanvasPreview'; isCanvasPreview: boolean }
  | { type: 'openResourceComposer'; command: NodeEditorCommand }
  | { type: 'selectCreatedNode'; nodeId: string }
  | { type: 'selectNode'; nodeId: string; panel: 'editor' | 'student-detail' | 'none' }
  | {
      type: 'showNodeInformationPreview';
      node: StudentAccessibleRoadmapNode;
      focusReturn: () => void;
    }
  | { type: 'completeNodeInformationPreview' };

const closedPanel: NodeSelectionPanel = { kind: 'closed' };
const editorPanel: NodeSelectionPanel = { kind: 'editor' };

function restorablePanelOf(panel: NodeSelectionPanel): RestorablePanel {
  if (panel.kind === 'editor') return { kind: 'editor' };
  if (panel.kind === 'node-information-preview') return { kind: 'closed' };
  return panel;
}

function withoutResourceComposer(panel: NodeSelectionPanel): NodeSelectionPanel {
  return panel.kind === 'editor' && panel.resourceComposerCommand ? editorPanel : panel;
}

function observeCanvasPreview(
  state: NodeSelectionState,
  isCanvasPreview: boolean,
): NodeSelectionState {
  if (state.isCanvasPreview === isCanvasPreview) return state;
  if (isCanvasPreview) {
    return {
      isCanvasPreview,
      selectedNodeId: null,
      panel: closedPanel,
      canvasPreviewReturn: {
        selectedNodeId: state.selectedNodeId,
        panel: restorablePanelOf(state.panel),
      },
    };
  }
  return {
    isCanvasPreview,
    selectedNodeId: state.canvasPreviewReturn?.selectedNodeId ?? null,
    panel: state.canvasPreviewReturn?.panel ?? closedPanel,
    canvasPreviewReturn: null,
  };
}

function nodeSelectionReducer(
  state: NodeSelectionState,
  action: NodeSelectionAction,
): NodeSelectionState {
  switch (action.type) {
    case 'reconcileSelection':
      return {
        ...state,
        selectedNodeId: action.removed ? null : state.selectedNodeId,
        panel:
          action.preserveEditorDraft && state.panel.kind === 'editor' ? state.panel : closedPanel,
      };
    case 'closeEditor':
      return state.panel.kind === 'editor' ? { ...state, panel: closedPanel } : state;
    case 'closeSelectedNode':
      return { ...state, selectedNodeId: null, panel: closedPanel };
    case 'closeNodeInformationPreview':
      return { ...state, panel: editorPanel };
    case 'observeCanvasPreview':
      return observeCanvasPreview(state, action.isCanvasPreview);
    case 'openResourceComposer':
      return {
        ...state,
        selectedNodeId: action.command.nodeId,
        panel: { kind: 'editor', resourceComposerCommand: action.command },
      };
    case 'selectCreatedNode':
      return {
        ...state,
        selectedNodeId: action.nodeId,
        panel: withoutResourceComposer(state.panel),
      };
    case 'selectNode':
      return {
        ...state,
        selectedNodeId: action.nodeId,
        panel:
          action.panel === 'student-detail'
            ? { kind: 'student-detail' }
            : action.panel === 'editor'
              ? editorPanel
              : withoutResourceComposer(state.panel),
      };
    case 'showNodeInformationPreview':
      return {
        ...state,
        panel: {
          kind: 'node-information-preview',
          node: action.node,
          isCompleted: false,
          focusReturn: action.focusReturn,
        },
      };
    case 'completeNodeInformationPreview':
      return state.panel.kind === 'node-information-preview'
        ? { ...state, panel: { ...state.panel, isCompleted: true } }
        : state;
  }
}

function useNodeSelectionState(isCanvasPreview: boolean) {
  const [state, dispatch] = useReducer(
    nodeSelectionReducer,
    isCanvasPreview,
    (initiallyInCanvasPreview): NodeSelectionState => ({
      selectedNodeId: null,
      panel: closedPanel,
      isCanvasPreview: initiallyInCanvasPreview,
      canvasPreviewReturn: null,
    }),
  );
  if (state.isCanvasPreview !== isCanvasPreview) {
    dispatch({ type: 'observeCanvasPreview', isCanvasPreview });
  }
  return { state, dispatch };
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
  nodes,
  mode,
  guardDraft,
  hasDraft,
  reportPracticeAction,
}: NodeSelectionOptions) {
  const { isStudentExperience, isEditing } = mode;
  const { canEditRoadmap } = mode.capabilities;
  const { state, dispatch } = useNodeSelectionState(mode.isCanvasPreview);
  const { selectedNodeId, panel } = state;
  const isStudentDetailOpen = panel.kind === 'student-detail';
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
    if (blocked && !isStudentDetailOpen) return;
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
    isStudentDetailOpen,
    selectedNodeId,
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
          panel: isStudentExperience ? 'student-detail' : canEditRoadmap ? 'editor' : 'none',
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
    dispatch({ type: 'closeSelectedNode' });
    requestFocusReturn('node');
  }, [dispatch, requestFocusReturn]);

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
    if (panel.kind !== 'node-information-preview') return;
    const { focusReturn } = panel;
    dispatch({ type: 'closeNodeInformationPreview' });
    requestAnimationFrame(() => focusReturn());
  }, [dispatch, panel]);

  const showNodeInformationPreview = useCallback(
    (node: StudentAccessibleRoadmapNode, focusReturn: () => void) =>
      dispatch({ type: 'showNodeInformationPreview', node, focusReturn }),
    [dispatch],
  );

  const completeNodeInformationPreview = useCallback(
    () => dispatch({ type: 'completeNodeInformationPreview' }),
    [dispatch],
  );

  const dismissTopmostPanel = useCallback(() => {
    if (!canEditRoadmap) return false;
    if (panel.kind === 'node-information-preview') {
      closeNodeInformationPreview();
      return true;
    }
    if (panel.kind === 'editor' && isEditing) {
      dispatch({ type: 'closeEditor' });
      return true;
    }
    return false;
  }, [canEditRoadmap, closeNodeInformationPreview, dispatch, isEditing, panel.kind]);

  return {
    selectedNodeId,
    panel,
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
