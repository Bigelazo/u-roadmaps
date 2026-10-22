'use client';

import type { ComponentProps } from 'react';
import { panelWidthLimits } from '@/features/roadmap/ui/ResizablePanel';
import { Sidebar, SidebarRail } from '@/shared/ui/sidebar';

type Props = Omit<ComponentProps<typeof Sidebar>, 'id' | 'side' | 'className'> & {
  id: string;
  railLabel: string;
  panelWidth: number;
  onPanelWidthChange?: (width: number) => void;
};

export function RoadmapSidePanel({
  id,
  railLabel,
  panelWidth,
  onPanelWidthChange,
  children,
  ...props
}: Props) {
  return (
    <Sidebar
      {...props}
      side="right"
      id={id}
      className="order-2 w-full! min-w-0 border-t border-border bg-card focus-within:ring-0 lg:order-0 lg:box-border lg:min-h-0 lg:w-(--sidebar-width)! lg:overflow-hidden lg:border-t-0 lg:border-l lg:shadow-(--shadow-roadmap-panel)"
    >
      {onPanelWidthChange ? (
        <SidebarRail
          ariaLabel={railLabel}
          controlsId={id}
          value={panelWidth}
          min={panelWidthLimits.min}
          max={panelWidthLimits.max}
          onValueChange={onPanelWidthChange}
          className="sm:hidden lg:flex"
        />
      ) : null}
      {children}
    </Sidebar>
  );
}
