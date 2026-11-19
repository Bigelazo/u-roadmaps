'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
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

const viewportShareLimit = 0.65;

function useViewportPanelMaxWidth() {
  const [maxWidth, setMaxWidth] = useState<number>(panelWidthLimits.max);
  useEffect(() => {
    const update = () =>
      setMaxWidth(
        Math.max(
          panelWidthLimits.min,
          Math.min(panelWidthLimits.max, Math.round(window.innerWidth * viewportShareLimit)),
        ),
      );
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return maxWidth;
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
  const maxWidth = useViewportPanelMaxWidth();
  return (
    <Sidebar
      {...props}
      ref={keyboardInsetRef}
      side="right"
      id={id}
      className="w-full! min-w-0 border-border bg-card focus-within:ring-0 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:bottom-(--keyboard-inset,0px) max-lg:z-50 max-lg:h-auto max-lg:overflow-hidden max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)] motion-safe:max-lg:animate-in motion-safe:max-lg:duration-200 motion-safe:max-lg:slide-in-from-bottom-10 motion-safe:max-lg:fade-in lg:box-border lg:min-h-0 lg:w-(--sidebar-width)! lg:max-w-[65vw] lg:overflow-hidden lg:border-l lg:shadow-(--shadow-roadmap-panel)"
    >
      {onPanelWidthChange ? (
        <SidebarRail
          ariaLabel={railLabel}
          controlsId={id}
          value={Math.min(panelWidth, maxWidth)}
          min={panelWidthLimits.min}
          max={maxWidth}
          onValueChange={onPanelWidthChange}
          className="sm:hidden lg:flex"
        />
      ) : null}
      {children}
    </Sidebar>
  );
}
