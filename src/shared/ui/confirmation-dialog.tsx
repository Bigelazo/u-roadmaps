'use client';

import * as React from 'react';
import { ArrowRight, CircleAlert, CircleHelp, TriangleAlert } from 'lucide-react';

import { cn } from 'cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/empty';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/shared/ui/item';
import { Separator } from '@/shared/ui/separator';
import { Spinner } from '@/shared/ui/spinner';

type ConfirmationIntent = 'default' | 'warning' | 'destructive';

type ConfirmationDetail =
  | {
      kind: 'item';
      id: string;
      title: string;
      description?: string;
      media?: React.ReactNode;
      badge?: string;
    }
  | {
      kind: 'relationship';
      id: string;
      source: string;
      target: string;
      description?: string;
    };

type ConfirmationSection = {
  title: string;
  items: ConfirmationDetail[];
  emptyMessage?: string;
};

type ConfirmationAction = {
  id: string;
  label: string;
};

type ConfirmationActions =
  readonly [ConfirmationAction] | readonly [ConfirmationAction, ConfirmationAction];

type ConfirmationPresentation = {
  title: string;
  description: string;
  intent: ConfirmationIntent;
  cancelLabel?: string;
  sections?: ConfirmationSection[];
  actions: ConfirmationActions;
};

type ConfirmationDialogProps = {
  confirmation: ConfirmationPresentation | null;
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

function ConfirmationDetailRow({ detail }: { detail: ConfirmationDetail }) {
  if (detail.kind === 'relationship') {
    return (
      <Item
        render={<li />}
        aria-label={`Relación: ${detail.source} → ${detail.target}`}
        variant="outline"
      >
        <ItemContent>
          <ItemTitle className="max-w-full flex-wrap whitespace-normal">
            <span>{detail.source}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span>{detail.target}</span>
          </ItemTitle>
          {detail.description ? <ItemDescription>{detail.description}</ItemDescription> : null}
        </ItemContent>
      </Item>
    );
  }

  return (
    <Item render={<li />} aria-label={detail.title} variant="outline">
      {detail.media ? <ItemMedia variant="icon">{detail.media}</ItemMedia> : null}
      <ItemContent>
        <ItemTitle>
          <span>{detail.title}</span>
          {detail.badge ? <Badge variant="secondary">{detail.badge}</Badge> : null}
        </ItemTitle>
        {detail.description ? <ItemDescription>{detail.description}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}

function ConfirmationDetails({ sections }: { sections: ConfirmationSection[] }) {
  const id = React.useId();

  return (
    <div className="grid gap-5">
      <Separator />
      {sections.map((section, index) => {
        const headingId = `${id}-section-${index}`;

        return (
          <section
            key={`${section.title}-${index}`}
            aria-labelledby={headingId}
            className="grid gap-2.5"
          >
            <h3 id={headingId} className="text-sm font-bold">
              {section.title}
            </h3>
            {section.items.length > 0 ? (
              <ItemGroup aria-label={section.title} className="gap-2">
                {section.items.map((detail) => (
                  <ConfirmationDetailRow key={detail.id} detail={detail} />
                ))}
              </ItemGroup>
            ) : (
              <Empty className="border border-dashed border-border py-4">
                <EmptyHeader>
                  <EmptyTitle>Sin elementos</EmptyTitle>
                  <EmptyDescription>
                    {section.emptyMessage ?? 'No hay elementos para mostrar.'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  pendingActionId,
  onCancel,
  onAction,
}: ConfirmationDialogProps) {
  const isPending = pendingActionId !== undefined;
  const finalFocusRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    const isOpen = confirmation !== null;

    if (isOpen && !wasOpenRef.current) {
      const activeElement = document.activeElement;
      finalFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    }

    wasOpenRef.current = isOpen;
  }, [confirmation]);

  return (
    <AlertDialog
      open={confirmation !== null}
      onOpenChange={(open, eventDetails) => {
        if (open) return;

        if (isPending) {
          eventDetails.cancel();
          return;
        }

        onCancel();
      }}
    >
      {confirmation ? (
        <AlertDialogContent
          data-intent={confirmation.intent}
          className="max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto sm:max-w-xl"
          finalFocus={finalFocusRef}
        >
          <AlertDialogHeader className="items-stretch gap-4 text-left">
            <div
              data-slot="alert-dialog-media"
              data-confirmation-intent-icon
              aria-hidden="true"
              className={cn(
                'flex size-10 items-center justify-center rounded-full',
                intentPresentation[confirmation.intent].iconClassName,
              )}
            >
              {React.createElement(intentPresentation[confirmation.intent].icon, {
                className: 'size-5',
              })}
            </div>
            <AlertDialogTitle className="tracking-tight">{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {confirmation.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmation.sections?.length ? (
            <ConfirmationDetails sections={confirmation.sections} />
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {confirmation.cancelLabel ?? 'Cancelar'}
            </AlertDialogCancel>
            {confirmation.actions.map((action, index) => {
              const isActionPending = pendingActionId === action.id;
              const isPrimary = index === confirmation.actions.length - 1;

              return (
                <AlertDialogAction
                  key={action.id}
                  type="button"
                  aria-busy={isActionPending || undefined}
                  data-emphasis={isPrimary ? 'primary' : 'secondary'}
                  data-intent={confirmation.intent}
                  disabled={isPending}
                  onClick={() => onAction(action.id)}
                  variant={
                    isPrimary ? intentPresentation[confirmation.intent].actionVariant : 'outline'
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
  type ConfirmationDetail,
  type ConfirmationDialogProps,
  type ConfirmationIntent,
  type ConfirmationPresentation,
  type ConfirmationSection,
};
