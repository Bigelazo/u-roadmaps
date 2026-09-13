import { Keyboard } from 'lucide-react';
import type { ReactNode } from 'react';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { cn } from 'cn';

function KeyboardShortcut({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="flex min-h-5 min-w-0 items-center">{keys}</dt>
      <dd className="leading-relaxed">{children}</dd>
    </>
  );
}

type KeyboardShortcutsProps = {
  isEditing: boolean;
  isSidePanelOpen: boolean;
};

export function KeyboardShortcuts({ isEditing, isSidePanelOpen }: KeyboardShortcutsProps) {
  return (
    <details
      aria-label="Atajos de teclado"
      data-placement="roadmap"
      className={cn(
        'group pointer-events-auto absolute right-5 bottom-[18px] z-4 w-[min(23rem,calc(100%-2.5rem))] overflow-hidden rounded-xl border border-border bg-card/95 text-xs text-muted-foreground shadow-lg shadow-black/5 backdrop-blur-sm',
        isSidePanelOpen &&
          'lg:right-[calc(var(--sidebar-width)+1.25rem)] lg:w-[min(23rem,calc(100%-var(--sidebar-width)-2.5rem))]',
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3.5 font-semibold text-foreground transition-colors outline-none marker:content-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
        <span className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-primary">
          <Keyboard className="size-3.5" aria-hidden="true" />
        </span>
        <span>Atajos de teclado</span>
        <span className="ml-auto text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Ayuda
        </span>
      </summary>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-border px-3.5 py-3.5">
        <KeyboardShortcut keys={<Kbd>Tab</Kbd>}>
          Recorrer los controles y elementos del mapa.
        </KeyboardShortcut>
        <KeyboardShortcut
          keys={
            <KbdGroup className="flex-wrap">
              <Kbd aria-label="Enter">↵</Kbd>
              <span aria-hidden="true">/</span>
              <Kbd aria-label="Espacio">␣</Kbd>
            </KbdGroup>
          }
        >
          Activar el control o seleccionar el elemento enfocado.
        </KeyboardShortcut>
        <KeyboardShortcut keys={<Kbd aria-label="Escape">Esc</Kbd>}>
          Cerrar el detalle o panel del nodo seleccionado.
        </KeyboardShortcut>
        {isEditing ? (
          <KeyboardShortcut keys={<Kbd>Flechas</Kbd>}>
            Mover una cuadrícula el nodo seleccionado. <Kbd aria-label="Shift">⇧</Kbd> +{' '}
            <Kbd>Flechas</Kbd> lo desplaza 5 cuadrículas.
          </KeyboardShortcut>
        ) : null}
        {isEditing ? (
          <KeyboardShortcut
            keys={
              <KbdGroup className="flex-wrap">
                <Kbd aria-label="Suprimir">⌦</Kbd>
                <span aria-hidden="true">/</span>
                <Kbd aria-label="Retroceso">⌫</Kbd>
              </KbdGroup>
            }
          >
            Eliminar la dependencia seleccionada, con confirmación.
          </KeyboardShortcut>
        ) : null}
        <KeyboardShortcut
          keys={
            <div className="flex flex-col items-start gap-1">
              <KbdGroup className="w-fit flex-none">
                <Kbd aria-label="Comando">⌘</Kbd>
                <span aria-hidden="true">+</span>
                <Kbd>B</Kbd>
              </KbdGroup>
              <KbdGroup className="w-fit flex-none">
                <Kbd>Ctrl</Kbd>
                <span aria-hidden="true">+</span>
                <Kbd>B</Kbd>
              </KbdGroup>
            </div>
          }
        >
          Ocultar o mostrar el panel lateral.
        </KeyboardShortcut>
        <KeyboardShortcut
          keys={
            <KbdGroup className="flex-wrap">
              <Kbd>Inicio</Kbd>
              <span aria-hidden="true">/</span>
              <Kbd>Fin</Kbd>
            </KbdGroup>
          }
        >
          Con el borde del panel enfocado, establecer su ancho mínimo o máximo.
        </KeyboardShortcut>
      </dl>
    </details>
  );
}
