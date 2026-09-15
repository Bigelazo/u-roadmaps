'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { panelWidthLimits } from '@/features/roadmap/ui/ResizablePanel';
import { Sidebar, SidebarContent, SidebarRail } from '@/shared/ui/sidebar';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  children: ReactNode;
};

export function NodeEditorPanel({ isOpen, panelWidth, onPanelWidthChange, children }: Props) {
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <Sidebar
      hidden={!isOpen}
      side="right"
      collapsible="none"
      id="roadmap-editor-panel"
      aria-label="Panel de edición del roadmap"
      className="order-2 w-full! min-w-0 border-t border-border bg-card focus-within:ring-0 lg:order-0 lg:box-border lg:min-h-0 lg:w-(--sidebar-width)! lg:overflow-hidden lg:border-t-0 lg:border-l lg:shadow-(--shadow-roadmap-panel)"
    >
      <SidebarRail
        ariaLabel="Redimensionar panel de edición"
        controlsId="roadmap-editor-panel"
        value={panelWidth}
        min={panelWidthLimits.min}
        max={panelWidthLimits.max}
        onValueChange={onPanelWidthChange}
        className="sm:hidden lg:flex"
      />
      <SidebarContent className="overflow-visible lg:overflow-y-auto">
        <details
          aria-label="Editor de nodo"
          open={isMobileEditorExpanded}
          onToggle={(event) => setIsMobileEditorExpanded(event.currentTarget.open)}
        >
          <summary className="min-h-11 cursor-pointer border-b border-border bg-cloud/70 px-5 py-3 text-sm font-bold text-primary lg:hidden">
            Editor de nodo
          </summary>
          <div className="pb-6">{children}</div>
        </details>
      </SidebarContent>
    </Sidebar>
  );
}
