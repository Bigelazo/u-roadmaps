import type { NodeEditorCommand } from '@/features/roadmap/editor/types';
import type { StudentAccessibleRoadmapNode } from '@/features/roadmap/types';

export type CanvasPanel = 'editor' | 'student' | 'none';

export type CanvasState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  teacherPreviewNode: StudentAccessibleRoadmapNode | null;
  isTeacherPreviewCompleted: boolean;
  resourceComposerCommand: NodeEditorCommand | null;
  teacherPreviewFocusReturn: (() => void) | null;
};

export type CanvasStateAction =
  | { type: 'closeEditor' }
  | { type: 'closeSelectedNode'; panel: Exclude<CanvasPanel, 'none'> }
  | { type: 'closeTeacherPreview' }
  | { type: 'prepareCanvasPreview' }
  | {
      type: 'restoreCanvasPreview';
      selectedNodeId: string | null;
      isEditorOpen: boolean;
      isStudentDetailOpen: boolean;
    }
  | { type: 'openResourceComposer'; command: NodeEditorCommand }
  | { type: 'selectCreatedNode'; nodeId: string }
  | { type: 'selectNode'; nodeId: string; panel: CanvasPanel }
  | {
      type: 'showTeacherPreview';
      node: StudentAccessibleRoadmapNode;
      focusReturn: () => void;
    }
  | { type: 'completeTeacherPreview' }
  | { type: 'toggleEditor' }
  | { type: 'toggleStudentDetail' };

export const initialCanvasState: CanvasState = {
  selectedNodeId: null,
  isEditorOpen: false,
  isStudentDetailOpen: false,
  teacherPreviewNode: null,
  isTeacherPreviewCompleted: false,
  resourceComposerCommand: null,
  teacherPreviewFocusReturn: null,
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
        resourceComposerCommand: null,
        teacherPreviewFocusReturn: null,
        ...(action.panel === 'editor' ? { isEditorOpen: false } : { isStudentDetailOpen: false }),
      };
    case 'closeTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isEditorOpen: true,
        teacherPreviewFocusReturn: null,
      };
    case 'prepareCanvasPreview':
      return {
        ...state,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isStudentDetailOpen: false,
        isEditorOpen: false,
        selectedNodeId: null,
        resourceComposerCommand: null,
        teacherPreviewFocusReturn: null,
      };
    case 'restoreCanvasPreview':
      return {
        ...state,
        selectedNodeId: action.selectedNodeId,
        isEditorOpen: action.isEditorOpen,
        isStudentDetailOpen: action.isStudentDetailOpen,
        resourceComposerCommand: null,
        teacherPreviewFocusReturn: null,
      };
    case 'openResourceComposer':
      return {
        ...state,
        selectedNodeId: action.command.nodeId,
        isEditorOpen: true,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        resourceComposerCommand: action.command,
        teacherPreviewFocusReturn: null,
      };
    case 'selectCreatedNode':
      return { ...state, selectedNodeId: action.nodeId, resourceComposerCommand: null };
    case 'selectNode':
      if (action.panel === 'student') {
        return {
          ...state,
          selectedNodeId: action.nodeId,
          isStudentDetailOpen: true,
          resourceComposerCommand: null,
        };
      }
      if (action.panel === 'editor') {
        return {
          ...state,
          selectedNodeId: action.nodeId,
          teacherPreviewNode: null,
          isTeacherPreviewCompleted: false,
          isEditorOpen: true,
          resourceComposerCommand: null,
          teacherPreviewFocusReturn: null,
        };
      }
      return { ...state, selectedNodeId: action.nodeId, resourceComposerCommand: null };
    case 'showTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: action.node,
        isTeacherPreviewCompleted: false,
        isEditorOpen: false,
        resourceComposerCommand: null,
        teacherPreviewFocusReturn: action.focusReturn,
      };
    case 'completeTeacherPreview':
      return { ...state, isTeacherPreviewCompleted: true };
    case 'toggleEditor':
      return { ...state, isEditorOpen: !state.isEditorOpen };
    case 'toggleStudentDetail':
      return { ...state, isStudentDetailOpen: !state.isStudentDetailOpen };
  }
}
