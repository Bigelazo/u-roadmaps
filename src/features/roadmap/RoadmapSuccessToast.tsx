'use client';

import { useEffect } from 'react';
import { CircleCheck, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const DISMISS_DELAY_MS = 6000;

type Props = {
  message: string;
  onDismiss: () => void;
};

export function RoadmapSuccessToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      aria-label={message}
      role="status"
      className="absolute right-5 bottom-[18px] z-[5] grid w-auto max-w-[min(22rem,calc(100%-2.5rem))] animate-in grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-lg border border-progress/25 bg-card px-2.5 py-2 text-left text-sm text-card-foreground shadow-[0_6px_18px_rgb(26_26_26_/_12%)] fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <CircleCheck aria-hidden="true" className="size-4 text-progress" />
      <p className="text-pretty">{message}</p>
      <Button
        aria-label="Cerrar notificación"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
        size="icon"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
