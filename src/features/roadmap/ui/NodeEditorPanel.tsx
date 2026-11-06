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
