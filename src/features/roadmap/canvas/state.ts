import type {
  RoadmapViewport,
  RoadmapViewportRestoration,
} from '@/features/roadmap/graph/roadmap-graph-projection';
import type { NodeEditorCommand } from '@/features/roadmap/editor/types';
import type { StudentAccessibleRoadmapNode } from '@/features/roadmap/types';
import type { NodeSelectionPanel } from './node-selection';

type RestorablePanel = { kind: 'closed' } | { kind: 'editor' } | { kind: 'student-detail' };

type CanvasPreviewReturnState = {
  selectedNodeId: string | null;
  panel: RestorablePanel;
  viewport: RoadmapViewport | null;
};

export type CanvasPreviewState =
  | { kind: 'inactive'; viewportRestoration: RoadmapViewportRestoration | null }
  | { kind: 'active'; returnState: CanvasPreviewReturnState };

export type CanvasState = {
  canvasPreview: CanvasPreviewState;
  selectedNodeId: string | null;
  panel: NodeSelectionPanel;
};

export type CanvasStateAction =
  | { type: 'closeEditor' }
  | { type: 'reconcileSelection'; removed: boolean; preserveEditorDraft?: boolean }
  | { type: 'closeSelectedNode' }
  | { type: 'closeNodeInformationPreview' }
  | { type: 'enterCanvasPreview'; viewport: RoadmapViewport | null }
  | { type: 'exitCanvasPreview'; viewportToken: string }
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

export const initialCanvasState: CanvasState = {
  canvasPreview: { kind: 'inactive', viewportRestoration: null },
  selectedNodeId: null,
  panel: closedPanel,
};

function restorablePanelOf(panel: NodeSelectionPanel): RestorablePanel {
  if (panel.kind === 'editor') return { kind: 'editor' };
  if (panel.kind === 'node-information-preview') return { kind: 'closed' };
  return panel;
}

function withoutResourceComposer(panel: NodeSelectionPanel): NodeSelectionPanel {
  return panel.kind === 'editor' && panel.resourceComposerCommand ? editorPanel : panel;
}

export function canvasStateReducer(state: CanvasState, action: CanvasStateAction): CanvasState {
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
    case 'enterCanvasPreview':
      if (state.canvasPreview.kind === 'active') return state;
      return {
        ...state,
        canvasPreview: {
          kind: 'active',
          returnState: {
            selectedNodeId: state.selectedNodeId,
            panel: restorablePanelOf(state.panel),
            viewport: action.viewport,
          },
        },
        selectedNodeId: null,
        panel: closedPanel,
      };
    case 'exitCanvasPreview': {
      if (state.canvasPreview.kind === 'inactive') return state;
      const { viewport, selectedNodeId, panel } = state.canvasPreview.returnState;
      return {
        ...state,
        selectedNodeId,
        panel,
        canvasPreview: {
          kind: 'inactive',
          viewportRestoration: viewport ? { token: action.viewportToken, viewport } : null,
        },
      };
    }
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
