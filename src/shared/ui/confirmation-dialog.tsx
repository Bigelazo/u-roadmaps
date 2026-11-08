'use client';

import * as React from 'react';
import { CircleAlert, CircleHelp, TriangleAlert } from 'lucide-react';

import { cn } from 'cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Spinner } from '@/shared/ui/spinner';

type ConfirmationIntent = 'default' | 'warning' | 'destructive';

type ConfirmationAction = {
  id: string;
  label: string;
  emphasis?: 'primary' | 'secondary';
  disabled?: boolean;
};

type ConfirmationActions =
  readonly [ConfirmationAction] | readonly [ConfirmationAction, ConfirmationAction];

type ConfirmationPresentation = {
  title: React.ReactNode;
  description: React.ReactNode;
  intent: ConfirmationIntent;
  cancelLabel?: string;
  content?: React.ReactNode;
  actions: ConfirmationActions;
};

type ConfirmationDialogProps = {
  confirmation: ConfirmationPresentation | null;
  className?: string;
  onDismiss?: () => void;
  pendingActionId?: string;
  onCancel: () => void;
  onAction: (actionId: string) => void;
};

const intentPresentation: Record<
  ConfirmationIntent,
  {
    icon: typeof CircleHelp;
    iconClassName: string;
    actionVariant: 'default' | 'destructive';
  }
> = {
  default: {
    icon: CircleHelp,
    iconClassName: 'bg-primary/10 text-primary',
    actionVariant: 'default',
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: 'bg-secondary text-secondary-foreground',
    actionVariant: 'default',
  },
  destructive: {
    icon: CircleAlert,
    iconClassName: 'bg-destructive/10 text-destructive',
    actionVariant: 'destructive',
  },
};

function emphasisOf(action: ConfirmationAction, index: number, actions: ConfirmationActions) {
  return action.emphasis ?? (index === actions.length - 1 ? 'primary' : 'secondary');
}

function ConfirmationDialog({
  confirmation,
  className,
  pendingActionId,
  onCancel,
  onDismiss = onCancel,
  onAction,
}: ConfirmationDialogProps) {
  const isPending = pendingActionId !== undefined;
  const finalFocusRef = React.useRef<HTMLElement | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    const isOpen = confirmation !== null;

    if (isOpen && !wasOpenRef.current) {
      const activeElement = document.activeElement;
      finalFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }

    wasOpenRef.current = isOpen;
  }, [confirmation]);

  const isWide =
    confirmation !== null && (confirmation.actions.length > 1 || !!confirmation.content);

  return (
    <AlertDialog
      open={confirmation !== null}
      onOpenChange={(open, eventDetails) => {
        if (open) return;

        if (isPending) {
          eventDetails.cancel();
          return;
        }

        if (eventDetails.reason === 'close-press') onCancel();
        else onDismiss();
      }}
    >
      {confirmation ? (
        <AlertDialogContent
          data-intent={confirmation.intent}
          data-layout={isWide ? 'wide' : 'compact'}
          className={cn(
            'max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-md',
            isWide && 'data-[size=default]:sm:max-w-xl',
            className,
          )}
          initialFocus={cancelRef}
          finalFocus={finalFocusRef}
        >
          <div
            data-slot="confirmation-header"
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-left"
          >
            <div
              data-confirmation-intent-icon
              aria-hidden="true"
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                intentPresentation[confirmation.intent].iconClassName,
              )}
            >
              {React.createElement(intentPresentation[confirmation.intent].icon, {
                className: 'size-5',
              })}
            </div>
            <AlertDialogTitle className="text-base leading-snug font-semibold tracking-tight text-pretty wrap-break-word">
              {confirmation.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="col-span-2 leading-relaxed text-pretty sm:col-span-1 sm:col-start-2">
              {confirmation.description}
            </AlertDialogDescription>
          </div>

          {confirmation.content ? (
            <div data-slot="confirmation-content" className="min-w-0 sm:pl-12">
              {confirmation.content}
            </div>
          ) : null}

          <AlertDialogFooter className="sm:flex-nowrap">
            <AlertDialogCancel ref={cancelRef} disabled={isPending}>
              {confirmation.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            {confirmation.actions.map((action, index) => {
              const isActionPending = pendingActionId === action.id;
              const emphasis = emphasisOf(action, index, confirmation.actions);

              return (
                <AlertDialogAction
                  key={action.id}
                  type="button"
                  autoFocus={false}
                  aria-busy={isActionPending || undefined}
                  data-emphasis={emphasis}
                  data-intent={confirmation.intent}
                  disabled={isPending || action.disabled}
                  onClick={() => onAction(action.id)}
                  variant={
                    emphasis === 'primary'
                      ? intentPresentation[confirmation.intent].actionVariant
                      : 'outline'
                  }
                >
                  {isActionPending ? (
                    <Spinner
                      aria-hidden="true"
                      data-confirmation-progress
                      data-testid="confirmation-progress"
                      data-icon="inline-start"
                    />
                  ) : null}
                  {action.label}
                </AlertDialogAction>
              );
            })}
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export {
  ConfirmationDialog,
  type ConfirmationAction,
  type ConfirmationDialogProps,
  type ConfirmationPresentation,
};
