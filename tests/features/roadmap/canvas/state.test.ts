import { describe, expect, test } from 'vitest';
import {
  canvasStateReducer,
  initialCanvasState,
  type CanvasState,
} from '@/features/roadmap/canvas/state';

function state(overrides: Partial<CanvasState> = {}): CanvasState {
  return { ...initialCanvasState, ...overrides };
}

describe('canvas state transitions', () => {
  test('opens a resource composer through an explicit transition and increments its request key', () => {
    const current = state({
      teacherPreviewNode: {
        id: 'old-node',
        title: 'Old node',
        description: null,
        nodeTypeId: 'content',
        positionX: 0,
        positionY: 0,
        isVisible: true,
        access: { status: 'ACCESSIBLE' },
        isCompleted: false,
        canComplete: true,
        resources: [],
      },
      isTeacherPreviewCompleted: true,
      resourceComposerRequest: 2,
    });

    expect(
      canvasStateReducer(current, { type: 'openResourceComposer', nodeId: 'new-node' }),
    ).toMatchObject({
      selectedNodeId: 'new-node',
      isEditorOpen: true,
      teacherPreviewNode: null,
      isTeacherPreviewCompleted: false,
      resourceComposerRequest: 3,
    });
  });

  test('closes only the panel associated with the selected node', () => {
    const current = state({
      selectedNodeId: 'node-1',
      isEditorOpen: true,
      isStudentDetailOpen: true,
      teacherPreviewNode: {
        id: 'node-1',
        title: 'Node',
        description: null,
        nodeTypeId: 'content',
        positionX: 0,
        positionY: 0,
        isVisible: true,
        access: { status: 'ACCESSIBLE' },
        isCompleted: false,
        canComplete: true,
        resources: [],
      },
      isTeacherPreviewCompleted: true,
    });

    expect(
      canvasStateReducer(current, { type: 'closeSelectedNode', panel: 'student' }),
    ).toMatchObject({
      selectedNodeId: null,
      isEditorOpen: true,
      isStudentDetailOpen: false,
      teacherPreviewNode: null,
      isTeacherPreviewCompleted: false,
    });
  });

  test('closes the editor panel through an explicit transition', () => {
    const current = state({ isEditorOpen: true });

    expect(canvasStateReducer(current, { type: 'closeEditor' })).toMatchObject({
      isEditorOpen: false,
    });
  });
});
