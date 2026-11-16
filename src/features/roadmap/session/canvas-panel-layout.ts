'use client';

import type { NodeSelectionPanel } from '@/features/roadmap/canvas/node-selection';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';

export function useCanvasPanelLayout(panel: NodeSelectionPanel) {
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  return panel.kind === 'editor' || panel.kind === 'node-information-preview'
    ? editorPanel
    : studentPanel;
}
