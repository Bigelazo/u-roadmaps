'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from 'cn';

const tones = {
  /** Sobre Ink: el borde Primary Bright mantiene el contorno visible y el texto blanco sobre Primary. */
  dark: 'border-primary-bright bg-primary text-primary-foreground hover:bg-primary-deep',
  light: 'bg-primary text-primary-foreground hover:bg-primary-deep',
  outline: '',
} as const;

/**
 * Inicia el ingreso institucional. El envío es una navegación nativa hacia U-Pasaporte,
 * así que el estado pendiente se marca al enviar y se limpia si el navegador restaura la
 * página desde la caché al volver atrás.
 */
export function InstitutionalLoginForm({
  tone = 'light',
  size = 'lg',
  compact = false,
  className,
}: {
  tone?: keyof typeof tones;
  size?: 'default' | 'lg';
  /** Bajo `sm` muestra solo «Ingresar»; el nombre accesible no cambia. */
  compact?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <form
      action="/api/plogin/start"
      method="post"
      className={className}
      onSubmit={(event) => {
        if (pending) event.preventDefault();
        else setPending(true);
      }}
    >
      <Button
        type="submit"
        size={size}
        variant={tone === 'outline' ? 'outline' : 'default'}
        aria-disabled={pending || undefined}
        className={cn(tones[tone], pending && 'cursor-progress')}
      >
        {pending ? (
          <>
            <Spinner aria-hidden="true" role={undefined} aria-label={undefined} />
            <span role="status">Redirigiendo a U-Pasaporte…</span>
          </>
        ) : (
          <>
            {compact ? (
              <span>
                Ingresar<span className="max-sm:sr-only"> con U-Pasaporte</span>
              </span>
            ) : (
              'Ingresar con U-Pasaporte'
            )}
            {tone === 'outline' ? null : <ArrowRight aria-hidden="true" data-icon="inline-end" />}
          </>
        )}
      </Button>
    </form>
  );
}
