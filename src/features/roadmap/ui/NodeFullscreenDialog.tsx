'use client';

import type { ReactNode } from 'react';
import { Maximize2, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NodeDescription } from './NodeDescription';
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
  triggerLabel = 'Ver nodo en pantalla completa',
}: {
  title: string;
  description?: string | null;
  children?: ReactNode;
  triggerLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="icon" />}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <Maximize2 />
      </DialogTrigger>
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] flex-col gap-6 p-6 sm:max-w-5xl sm:p-8"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle className="wrap-break-word">{title}</DialogTitle>
        </DialogHeader>
        <div className="-m-1 min-h-0 flex-1 overflow-y-auto p-1">
          {children ?? (
            <DialogDescription render={<div />}>
              <NodeDescription description={description} />
            </DialogDescription>
          )}
        </div>
        <DialogClose
          render={<Button type="button" variant="ghost" size="icon" />}
          className="absolute top-4 right-4"
          aria-label="Cerrar pantalla completa"
          title="Cerrar pantalla completa"
        >
          <X />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
