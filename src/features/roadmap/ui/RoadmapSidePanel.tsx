'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { panelWidthLimits } from '@/features/roadmap/ui/ResizablePanel';
import { Sidebar, SidebarRail } from '@/shared/ui/sidebar';

type Props = Omit<ComponentProps<typeof Sidebar>, 'id' | 'side' | 'className'> & {
  id: string;
  railLabel: string;
  panelWidth: number;
  onPanelWidthChange?: (width: number) => void;
};

function useVirtualKeyboardInset() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      ref.current?.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return ref;
}

export function RoadmapSidePanel({
  id,
  railLabel,
  panelWidth,
  onPanelWidthChange,
  children,
  ...props
}: Props) {
  const keyboardInsetRef = useVirtualKeyboardInset();
  return (
    <Sidebar
      {...props}
      ref={keyboardInsetRef}
      side="right"
      id={id}
      className="w-full! min-w-0 border-border bg-card focus-within:ring-0 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-(--keyboard-inset,0px) max-lg:z-50 max-lg:h-auto max-lg:max-h-[min(70dvh,var(--roadmap-panel-max-height,70dvh),calc(100dvh-var(--keyboard-inset,0px)-1rem))] max-lg:overflow-hidden max-lg:rounded-t-xl max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] max-lg:shadow-lg motion-safe:max-lg:animate-in motion-safe:max-lg:duration-200 motion-safe:max-lg:slide-in-from-bottom-10 motion-safe:max-lg:fade-in lg:box-border lg:min-h-0 lg:w-(--sidebar-width)! lg:overflow-hidden lg:border-l lg:shadow-(--shadow-roadmap-panel)"
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
