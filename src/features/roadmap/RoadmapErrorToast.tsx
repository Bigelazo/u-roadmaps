'use client';

import { useEffect } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { Alert, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';

const DISMISS_DELAY_MS = 6000;

type Props = {
  message: string;
  onDismiss: () => void;
};

export function RoadmapErrorToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <Alert
      aria-label={message}
      variant="destructive"
      className="absolute right-5 bottom-[18px] z-[5] w-auto max-w-[min(22rem,calc(100%-2.5rem))] animate-in items-center gap-x-2.5 border-destructive/25 pr-1.5 shadow-[0_6px_18px_rgb(26_26_26_/_12%)] fade-in slide-in-from-bottom-2 has-[>svg]:grid-cols-[auto_1fr_auto] motion-reduce:animate-none"
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle className="font-normal text-pretty">{message}</AlertTitle>
      <Button
        aria-label="Cerrar alerta"
        className="size-7 text-destructive hover:text-destructive"
        onClick={onDismiss}
        size="icon"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
    </Alert>
  );
}
