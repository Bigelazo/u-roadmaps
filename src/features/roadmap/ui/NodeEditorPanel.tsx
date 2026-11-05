'use client';

import type { ReactNode } from 'react';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { useCompactCanvasLayout } from '@/features/roadmap/ui/compact-canvas-layout';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { SidebarContent } from '@/shared/ui/sidebar';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  children: ReactNode;
};

const panelId = 'roadmap-editor-panel';
const panelLabel = 'Panel de edición del roadmap';

/**
 * Wide layout: a resizable side column next to the canvas.
 * Compact layout: a non-modal bottom sheet over the canvas, so the canvas
 * keeps the whole viewport and stays pannable above the editor. Tapping the
 * canvas background or "Deseleccionar nodo" closes it through the selection.
 * Both keep the editor mounted while closed so an unsaved draft survives.
 */
export function NodeEditorPanel({ isOpen, panelWidth, onPanelWidthChange, children }: Props) {
  const isCompact = useCompactCanvasLayout();
  const editor = (
    <div role="group" aria-label="Editor de nodo" className="pb-6">
      {children}
    </div>
  );

  if (isCompact) {
    return (
      <Sheet open={isOpen} modal={false} disablePointerDismissal>
        <SheetContent
          keepMounted
          id={panelId}
          aria-label={panelLabel}
          side="bottom"
          showOverlay={false}
          showCloseButton={false}
          initialFocus={false}
          className="max-h-[70dvh] gap-0 overflow-hidden rounded-t-xl bg-card pb-[env(safe-area-inset-bottom)]"
        >
          <SidebarContent className="min-h-0 overflow-y-auto">{editor}</SidebarContent>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <RoadmapSidePanel
      hidden={!isOpen}
      id={panelId}
      aria-label={panelLabel}
      railLabel="Redimensionar panel de edición"
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
      <SidebarContent className="overflow-y-auto">{editor}</SidebarContent>
    </RoadmapSidePanel>
  );
}
