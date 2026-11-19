'use client';

import type { ReactNode } from 'react';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { SidebarContent } from '@/shared/ui/sidebar';

export const NODE_EDITOR_PANEL_ID = 'roadmap-editor-panel';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  children: ReactNode;
};

export function NodeEditorPanel({ isOpen, panelWidth, onPanelWidthChange, children }: Props) {
  return (
    <RoadmapSidePanel
      hidden={!isOpen}
      role="region"
      id={NODE_EDITOR_PANEL_ID}
      tabIndex={-1}
      aria-label="Panel de edición del roadmap"
      railLabel="Redimensionar panel de edición"
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <SidebarContent className="min-h-0 overflow-y-auto">
        <div role="group" aria-label="Editor de nodo" className="flex flex-1 flex-col">
          {children}
        </div>
      </SidebarContent>
    </RoadmapSidePanel>
  );
}
