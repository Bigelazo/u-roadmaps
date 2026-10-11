'use client';

import { useEffect } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { cn } from 'cn';
import { Alert, AlertTitle } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';

const DISMISS_DELAY_MS = 6000;

const toastClassName =
  'pointer-events-auto z-5 w-auto max-w-[min(22rem,100%)] animate-in items-center gap-x-2.5 shadow-[0_6px_18px_rgb(26_26_26/12%)] fade-in slide-in-from-top-2 has-[>svg]:grid-cols-[auto_1fr_auto] motion-reduce:animate-none';

const tones = {
  error: {
    variant: 'destructive',
    role: undefined,
    Icon: CircleAlert,
    className: cn(toastClassName, 'border-destructive/25 pr-1.5'),
    closeClassName: 'size-7 text-destructive hover:text-destructive',
  },
  success: {
    variant: 'default',
    role: 'status',
    Icon: CircleCheck,
    // Cancels Alert's icon nudge, row span and narrower icon gap so the toast keeps its own layout.
    className: cn(
      toastClassName,
      'border-progress/25 has-[>svg]:gap-x-2.5 *:[svg]:row-span-1 *:[svg]:translate-y-0 *:[svg]:text-progress',
    ),
    closeClassName: 'size-7 text-muted-foreground hover:text-foreground',
  },
} as const;

type Props = {
  tone: keyof typeof tones;
  message: string;
  closeLabel: string;
  onDismiss: () => void;
};

/** Transient toast feedback with a close button; it dismisses itself after 6 s. */
export function DismissibleAlert({ tone, message, closeLabel, onDismiss }: Props) {
  const { variant, role, Icon, className, closeClassName } = tones[tone];

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <Alert aria-label={message} {...(role && { role })} variant={variant} className={className}>
      <Icon aria-hidden="true" />
      <AlertTitle className="font-normal text-pretty">{message}</AlertTitle>
      <Button
        aria-label={closeLabel}
        className={closeClassName}
        onClick={onDismiss}
        size="icon"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
    </Alert>
  );
}
