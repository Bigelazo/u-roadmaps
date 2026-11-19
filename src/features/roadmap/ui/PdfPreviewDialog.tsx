'use client';

import { useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { Download, X } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';

function subscribeToNothing() {
  return () => {};
}

function useInlinePdfSupported() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => navigator.pdfViewerEnabled !== false,
    () => true,
  );
}

export function PdfPreviewDialog({
  resource,
  trigger,
}: Readonly<{ resource: Resource; trigger: ReactElement }>) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        initialFocus={closeRef}
        overlayClassName="bg-scrim supports-backdrop-filter:backdrop-blur-md"
        className="inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-hidden rounded-none bg-transparent px-2 pt-14 pb-2 ring-0 sm:max-w-none sm:px-16 sm:py-[4dvh]"
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <DialogTitle className="sr-only">{resource.title}</DialogTitle>
        <DialogClose
          ref={closeRef}
          render={<Button type="button" variant="secondary" size="icon" />}
          className="absolute top-1.5 right-1.5 rounded-full shadow-md sm:top-2.5 sm:right-2.5"
          aria-label="Cerrar vista previa"
        >
          <X />
        </DialogClose>
        <PdfFrame resource={resource} />
      </DialogContent>
    </Dialog>
  );
}

function PdfFrame({ resource }: Readonly<{ resource: Resource }>) {
  const inlineSupported = useInlinePdfSupported();
  if (!inlineSupported) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl bg-popover p-6 text-center text-sm text-popover-foreground shadow-xl">
        <p>Este navegador no puede mostrar el PDF aquí. Descárgalo para verlo.</p>
        <a
          href={resource.url}
          download={resource.title}
          className={buttonVariants({ variant: 'default' })}
        >
          <Download data-icon="inline-start" />
          Descargar
        </a>
      </div>
    );
  }
  return (
    <iframe
      title={`Vista previa de ${resource.title}`}
      src={`${resource.url}?disposition=inline`}
      className="size-full rounded-lg bg-popover shadow-2xl sm:h-full sm:w-[min(1100px,100%)]"
    />
  );
}
