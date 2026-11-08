'use client';

import { useEffect, useRef, useState, type ComponentProps, type ReactElement } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export const longPressDelayMs = 500;
export const longPressTooltipDurationMs = 1500;
const longPressMoveTolerancePx = 10;

type IconTooltipProps = {
  label: string;
  render: ReactElement;
  enabled?: boolean;
  delay?: number;
  side?: ComponentProps<typeof TooltipContent>['side'];
};

export function IconTooltip({ enabled = true, render, ...props }: IconTooltipProps) {
  if (!enabled) return render;
  return <LongPressTooltip render={render} {...props} />;
}

function LongPressTooltip({ label, render, delay, side }: Omit<IconTooltipProps, 'enabled'>) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const pressedLong = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(pressTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelPress = () => {
    clearTimeout(pressTimer.current);
    pressOrigin.current = null;
  };

  const startPress = (event: ReactPointerEvent) => {
    pressedLong.current = false;
    cancelPress();
    if (event.pointerType !== 'touch') return;
    clearTimeout(closeTimer.current);
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      pressedLong.current = true;
      setOpen(true);
    }, longPressDelayMs);
  };

  const trackPress = (event: ReactPointerEvent) => {
    const origin = pressOrigin.current;
    if (!origin || event.pointerType !== 'touch') return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > longPressMoveTolerancePx)
      cancelPress();
  };

  const endPress = () => {
    cancelPress();
    if (!pressedLong.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), longPressTooltipDurationMs);
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        clearTimeout(closeTimer.current);
        setOpen(next);
      }}
    >
      <TooltipTrigger
        delay={delay}
        render={render}
        className="select-none [-webkit-touch-callout:none]"
        onPointerDown={startPress}
        onPointerMove={trackPress}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onKeyDown={() => {
          pressedLong.current = false;
        }}
        onContextMenu={(event) => {
          if (pressOrigin.current || pressedLong.current) event.preventDefault();
        }}
        onClickCapture={(event) => {
          if (!pressedLong.current) return;
          pressedLong.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
