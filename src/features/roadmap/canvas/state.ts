import type { StudentAccessibleRoadmapNode } from '@/features/roadmap/types';

export type CanvasPanel = 'editor' | 'student' | 'none';

export type CanvasState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  editorKey: number;
  teacherPreviewNode: StudentAccessibleRoadmapNode | null;
  isTeacherPreviewCompleted: boolean;
  resourceComposerRequest: number;
};

export type CanvasStateAction =
  | { type: 'closeEditor' }
  | { type: 'closeSelectedNode'; panel: Exclude<CanvasPanel, 'none'> }
  | { type: 'closeTeacherPreview' }
  | { type: 'prepareCanvasPreview'; discardDraft: boolean }
  | {
      type: 'restoreCanvasPreview';
      selectedNodeId: string | null;
      isEditorOpen: boolean;
      isStudentDetailOpen: boolean;
    }
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
    case 'prepareCanvasPreview':
      return {
        ...state,
        editorKey: action.discardDraft ? state.editorKey + 1 : state.editorKey,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isStudentDetailOpen: false,
        isEditorOpen: false,
        selectedNodeId: null,
      };
    case 'restoreCanvasPreview':
      return {
        ...state,
        selectedNodeId: action.selectedNodeId,
        isEditorOpen: action.isEditorOpen,
        isStudentDetailOpen: action.isStudentDetailOpen,
      };
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
