import type { Viewport } from '@xyflow/react';
import type { StudentAccessibleRoadmapNode } from '@/features/roadmap/types';

export type CanvasPanel = 'editor' | 'student' | 'none';

export type CanvasPreviewReturnState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  viewport: Viewport | null;
};

export type CanvasState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  isCanvasPreview: boolean;
  previewReturnState: CanvasPreviewReturnState | null;
  restoreViewport: Viewport | null;
  editorKey: number;
  teacherPreviewNode: StudentAccessibleRoadmapNode | null;
  isTeacherPreviewCompleted: boolean;
  resourceComposerRequest: number;
};

export type CanvasStateAction =
  | { type: 'closeEditor' }
  | { type: 'closeSelectedNode'; panel: Exclude<CanvasPanel, 'none'> }
  | { type: 'closeTeacherPreview' }
  | { type: 'enterCanvasPreview'; viewport: Viewport | null; discardDraft: boolean }
  | { type: 'exitCanvasPreview' }
  | { type: 'openResourceComposer'; nodeId: string }
  | { type: 'selectCreatedNode'; nodeId: string }
  | { type: 'selectNode'; nodeId: string; panel: CanvasPanel }
  | { type: 'showTeacherPreview'; node: StudentAccessibleRoadmapNode }
  | { type: 'completeTeacherPreview' }
  | { type: 'toggleEditor' }
  | { type: 'toggleStudentDetail' };

export const initialCanvasState: CanvasState = {
  selectedNodeId: null,
  isEditorOpen: false,
  isStudentDetailOpen: false,
  isCanvasPreview: false,
  previewReturnState: null,
  restoreViewport: null,
  editorKey: 0,
  teacherPreviewNode: null,
  isTeacherPreviewCompleted: false,
  resourceComposerRequest: 0,
};

export function canvasStateReducer(state: CanvasState, action: CanvasStateAction): CanvasState {
  switch (action.type) {
    case 'closeEditor':
      return { ...state, isEditorOpen: false };
    case 'closeSelectedNode':
      return {
        ...state,
        selectedNodeId: null,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        ...(action.panel === 'editor' ? { isEditorOpen: false } : { isStudentDetailOpen: false }),
      };
    case 'closeTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isEditorOpen: true,
      };
    case 'enterCanvasPreview':
      return {
        ...state,
        editorKey: action.discardDraft ? state.editorKey + 1 : state.editorKey,
        restoreViewport: null,
        previewReturnState: {
          selectedNodeId: state.selectedNodeId,
          isEditorOpen: state.isEditorOpen,
          isStudentDetailOpen: state.isStudentDetailOpen,
          viewport: action.viewport,
        },
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isStudentDetailOpen: false,
        isEditorOpen: false,
        selectedNodeId: null,
        isCanvasPreview: true,
      };
    case 'exitCanvasPreview': {
      const previous = state.previewReturnState;
      return {
        ...state,
        isCanvasPreview: false,
        selectedNodeId: previous?.selectedNodeId ?? null,
        isEditorOpen: previous?.isEditorOpen ?? false,
        isStudentDetailOpen: previous?.isStudentDetailOpen ?? false,
        restoreViewport: previous?.viewport ?? null,
        previewReturnState: null,
      };
    }
    case 'openResourceComposer':
      return {
        ...state,
        selectedNodeId: action.nodeId,
        isEditorOpen: true,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        resourceComposerRequest: state.resourceComposerRequest + 1,
      };
    case 'selectCreatedNode':
      return { ...state, selectedNodeId: action.nodeId };
    case 'selectNode':
      if (action.panel === 'student') {
        return { ...state, selectedNodeId: action.nodeId, isStudentDetailOpen: true };
      }
      if (action.panel === 'editor') {
        return {
          ...state,
          selectedNodeId: action.nodeId,
          teacherPreviewNode: null,
          isTeacherPreviewCompleted: false,
          isEditorOpen: true,
        };
      }
      return { ...state, selectedNodeId: action.nodeId };
    case 'showTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: action.node,
        isTeacherPreviewCompleted: false,
        isEditorOpen: false,
      };
    case 'completeTeacherPreview':
      return { ...state, isTeacherPreviewCompleted: true };
    case 'toggleEditor':
      return { ...state, isEditorOpen: !state.isEditorOpen };
    case 'toggleStudentDetail':
      return { ...state, isStudentDetailOpen: !state.isStudentDetailOpen };
  }
}
