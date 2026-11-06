'use client';

import type { ReactNode } from 'react';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { SidebarContent } from '@/shared/ui/sidebar';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  children: ReactNode;
};

/**
 * A resizable column next to a wide canvas and a non-modal bottom sheet over a
 * compact one, so the canvas stays pannable above the editor. The layouts differ
 * only in CSS: one element keeps an unsaved draft mounted while the panel is
 * closed and when the viewport crosses the breakpoint, as rotating a tablet does.
 */
export function NodeEditorPanel({ isOpen, panelWidth, onPanelWidthChange, children }: Props) {
  return (
    <RoadmapSidePanel
      hidden={!isOpen}
      role="region"
      id="roadmap-editor-panel"
      aria-label="Panel de edición del roadmap"
      railLabel="Redimensionar panel de edición"
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <SidebarContent className="min-h-0 overflow-y-auto">
        <div role="group" aria-label="Editor de nodo" className="pb-6">
          {children}
        </div>
      </SidebarContent>
    </RoadmapSidePanel>
  );
}
