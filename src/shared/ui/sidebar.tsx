'use client';

import * as React from 'react';
import { cn } from 'cn';

const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';

function SidebarProvider({ className, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-wrapper"
      style={
        {
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
        className,
      )}
      {...props}
    />
  );
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
}) {
  return (
    <div
      data-slot="sidebar"
      data-side={side}
      data-variant={variant}
      className={cn(
        'group relative flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground transition-shadow focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type ResizableSidebarRailProps = {
  ariaLabel: string;
  controlsId: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

function SidebarRail({
  className,
  ariaLabel,
  controlsId,
  value,
  min,
  max,
  onValueChange,
  ...props
}: React.ComponentProps<'button'> & ResizableSidebarRailProps) {
  const railRef = React.useRef<HTMLButtonElement>(null);
  const activePointerId = React.useRef<number | null>(null);
  const changeWidth = (nextValue: number) => {
    onValueChange(Math.min(max, Math.max(min, nextValue)));
  };

  const resizeFromPointer = (clientX: number) => {
    const sidebar = railRef.current?.closest<HTMLElement>('[data-slot="sidebar"]');
    if (!sidebar) return;
    changeWidth(sidebar.getBoundingClientRect().right - clientX);
  };

  return (
    <button
      ref={railRef}
      data-sidebar="rail"
      data-slot="sidebar-rail"
      role="separator"
      type="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-controls={controlsId}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`Ancho del panel: ${value} píxeles`}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 cursor-col-resize touch-none items-center justify-center outline-none select-none after:absolute after:inset-y-0 after:inset-s-1/2 after:w-px after:bg-sidebar-border hover:after:w-0.5 hover:after:bg-primary focus-visible:after:w-0.5 focus-visible:after:bg-primary sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
        'group-data-[side=left]:-right-4 group-data-[side=right]:left-0',
        className,
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        activePointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        resizeFromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (activePointerId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        resizeFromPointer(event.clientX);
      }}
      onPointerUp={(event) => {
        if (activePointerId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        activePointerId.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (activePointerId.current === event.pointerId) activePointerId.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Home') changeWidth(min);
        else if (event.key === 'End') changeWidth(max);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') changeWidth(value - 20);
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') changeWidth(value + 20);
        else return;
        event.preventDefault();
      }}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

export { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarRail };
