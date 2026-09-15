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
  test('opens a resource composer through a typed one-shot command', () => {
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
      resourceComposerCommand: null,
    });

    expect(
      canvasStateReducer(current, {
        type: 'openResourceComposer',
        command: { id: 'command-3', kind: 'open-resource', nodeId: 'new-node', mode: 'file' },
      }),
    ).toMatchObject({
      selectedNodeId: 'new-node',
      isEditorOpen: true,
      teacherPreviewNode: null,
      isTeacherPreviewCompleted: false,
      resourceComposerCommand: {
        id: 'command-3',
        kind: 'open-resource',
        nodeId: 'new-node',
        mode: 'file',
      },
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
