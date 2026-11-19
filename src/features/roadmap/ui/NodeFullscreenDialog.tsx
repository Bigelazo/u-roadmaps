'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import type { ReactElement, ReactNode } from 'react';
import { Maximize2, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NodeDescription } from './LazyNodeDescription';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';

export function NodeFullscreenDialog({
  title,
  description,
  children,
  trigger,
  actions,
  triggerLabel = 'Ver nodo en pantalla completa',
}: {
  title: string;
  description?: string | null;
  children?: ReactNode;
  trigger?: ReactElement;
  actions?: ReactNode;
  triggerLabel?: string;
}) {
  return (
    <Dialog>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={<Button type="button" variant="ghost" size="icon" />}
                aria-label={triggerLabel}
              >
                <Maximize2 />
              </DialogTrigger>
            }
          />
          <TooltipContent>{triggerLabel}</TooltipContent>
        </Tooltip>
      )}
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] flex-col gap-6 p-6 sm:max-w-5xl sm:p-8"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 pr-10">
          <DialogTitle className="min-w-0 wrap-break-word">{title}</DialogTitle>
          {actions}
        </DialogHeader>
        <div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1">
          {children ?? (
            <DialogDescription render={<div />}>
              <NodeDescription description={description} />
            </DialogDescription>
          )}
        </div>
        <Tooltip
          onOpenChange={(_open, details) => {
            if (details.reason === 'escape-key') details.allowPropagation();
          }}
        >
          <TooltipTrigger
            render={
              <DialogClose
                render={<Button type="button" variant="ghost" size="icon" />}
                className="absolute top-4 right-4"
                aria-label="Cerrar pantalla completa"
              >
                <X />
              </DialogClose>
            }
          />
          <TooltipContent>Cerrar pantalla completa</TooltipContent>
        </Tooltip>
      </DialogContent>
    </Dialog>
  );
}
