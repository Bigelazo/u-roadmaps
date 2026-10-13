'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RoadmapSidePanel } from '@/features/roadmap/ui/RoadmapSidePanel';
import { SidebarContent } from '@/shared/ui/sidebar';

type Props = {
  isOpen: boolean;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  expandRequest?: string;
  children: ReactNode;
};

export function NodeEditorPanel({
  isOpen,
  panelWidth,
  onPanelWidthChange,
  expandRequest,
  children,
}: Props) {
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);
  const [handledExpandRequest, setHandledExpandRequest] = useState(expandRequest);
  if (expandRequest !== handledExpandRequest) {
    setHandledExpandRequest(expandRequest);
    if (expandRequest) setIsMobileEditorExpanded(true);
  }

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    setIsMobileEditorExpanded(media.matches || Boolean(expandRequest));
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [expandRequest]);

  return (
    <RoadmapSidePanel
      hidden={!isOpen}
      id="roadmap-editor-panel"
      aria-label="Panel de edición del roadmap"
      railLabel="Redimensionar panel de edición"
      panelWidth={panelWidth}
      onPanelWidthChange={onPanelWidthChange}
    >
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
    </RoadmapSidePanel>
  );
}
