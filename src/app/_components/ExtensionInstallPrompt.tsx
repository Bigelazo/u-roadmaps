'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  extensionBrowserOf,
  extensionPromptStorageKey,
  extensionStores,
  parseExtensionPromptRecord,
  visitExtensionPrompt,
  type ExtensionBrowser,
  type ExtensionPromptRecord,
} from '@/shared/u-cursos-extension';

type Prompt = { browser: ExtensionBrowser; offerOptOut: boolean; record: ExtensionPromptRecord };

function storeRecord(record: ExtensionPromptRecord) {
  try {
    localStorage.setItem(extensionPromptStorageKey, JSON.stringify(record));
  } catch {
    return;
  }
}

function anotherDialogIsOpen() {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

export function ExtensionInstallPrompt({ suppressed }: Readonly<{ suppressed: boolean }>) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [open, setOpen] = useState(false);
  const [optOut, setOptOut] = useState(false);
  const installRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (suppressed || window.self !== window.top) return;
    const browser = extensionBrowserOf(navigator.userAgent);
    if (!browser) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(extensionPromptStorageKey);
    } catch {
      return;
    }
    const visit = visitExtensionPrompt(parseExtensionPromptRecord(stored), Date.now());
    if (visit.prompt && anotherDialogIsOpen()) return;
    storeRecord(visit.record);
    if (!visit.prompt) return;
    setPrompt({ browser, offerOptOut: visit.prompt.offerOptOut, record: visit.record });
    setOpen(true);
  }, [suppressed]);

  if (!prompt) return null;
  const store = extensionStores[prompt.browser];

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && optOut) storeRecord({ ...prompt.record, optedOut: true });
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent initialFocus={installRef}>
        <DialogHeader>
          <DialogTitle>Usa U-Roadmaps dentro de U-Cursos</DialogTitle>
          <DialogDescription>
            Con la extensión para {store.name} ves tus roadmaps directamente en la página de cada
            curso de U-Cursos, sin cambiar de pestaña.
          </DialogDescription>
        </DialogHeader>
        {prompt.offerOptOut ? (
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium select-none">
            <Checkbox checked={optOut} onCheckedChange={setOptOut} />
            No volver a mostrar
          </label>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => changeOpen(false)}>
            Ahora no
          </Button>
          <a
            ref={installRef}
            href={store.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => changeOpen(false)}
            className={buttonVariants()}
          >
            Instalar en {store.name}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
            <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
