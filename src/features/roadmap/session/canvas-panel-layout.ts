'use client';

import type { CanvasMode } from '@/features/roadmap/canvas/mode';
import type { NodeSelectionPanel } from '@/features/roadmap/canvas/node-selection';
import { isStudentBlockedNode } from '@/features/roadmap/student/node-status';
import type { RoadmapNode, StudentRoadmapNode } from '@/features/roadmap/types';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';

export type OpenCanvasPanel = 'editor' | 'student-detail' | 'node-information-preview';

export type CanvasPanelLayout = {
  openPanel: OpenCanvasPanel | null;
  width: number;
  setWidth: (width: number) => void;
};

function openCanvasPanel(
  panel: NodeSelectionPanel,
  mode: Pick<CanvasMode, 'isEditing' | 'isStudentExperience'>,
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined,
): OpenCanvasPanel | null {
  if (panel.kind === 'node-information-preview') return 'node-information-preview';
  if (panel.kind === 'editor') return mode.isEditing ? 'editor' : null;
  if (panel.kind === 'student-detail') {
    return mode.isStudentExperience && selectedNode && !isStudentBlockedNode(selectedNode)
      ? 'student-detail'
      : null;
  }
  return null;
}

export function useCanvasPanelLayout({
  panel,
  mode,
  selectedNode,
}: {
  panel: NodeSelectionPanel;
  mode: Pick<CanvasMode, 'isEditing' | 'isStudentExperience'>;
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined;
}): CanvasPanelLayout {
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const openPanel = openCanvasPanel(panel, mode, selectedNode);
  const { width, setWidth } =
    openPanel === 'editor' || openPanel === 'node-information-preview' ? editorPanel : studentPanel;
  return { openPanel, width, setWidth };
}
