import { RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/button';

type CanvasPreviewToolbarProps = {
  canReset: boolean;
  isHistorical: boolean;
  onRequestReset: () => void;
  onExit: () => void;
};

export function CanvasPreviewToolbar({
  canReset,
  isHistorical,
  onRequestReset,
  onExit,
}: CanvasPreviewToolbarProps) {
  return (
    <div className="pointer-events-auto flex w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lg shadow-black/5 backdrop-blur-sm sm:w-auto sm:flex-nowrap">
      <p className="px-2 text-sm font-semibold text-foreground">Previsualización del canvas</p>
      {canReset ? (
        <Button type="button" variant="outline" size="sm" onClick={onRequestReset}>
          <RotateCcw data-icon="inline-start" />
          Reiniciar progreso
        </Button>
      ) : null}
      <Button type="button" size="sm" onClick={onExit}>
        {isHistorical ? 'Volver al roadmap' : 'Ir al editor'}
      </Button>
    </div>
  );
}
