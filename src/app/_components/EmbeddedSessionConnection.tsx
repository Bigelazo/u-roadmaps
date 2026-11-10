'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Network } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';

type Step = 'checking' | 'permission' | 'login';

const steps = {
  permission: {
    title: 'Conecta U-Roadmaps con U-Cursos',
    description:
      'Tu navegador necesita tu permiso para usar tu sesión de U-Roadmaps dentro de U-Cursos.',
  },
  login: {
    title: 'Ingresa a U-Roadmaps',
    description:
      'Ingresa con U-Pasaporte en una pestaña nueva. Cuando termines, vuelve aquí para ver el roadmap.',
  },
} as const;

async function currentStep(): Promise<Step> {
  if (typeof document.hasStorageAccess !== 'function') return 'login';
  return (await document.hasStorageAccess()) ? 'login' : 'permission';
}

async function reloadWithStorageAccess() {
  if (typeof document.requestStorageAccess === 'function') {
    await document.requestStorageAccess();
  }
  window.location.reload();
}

export function EmbeddedSessionConnection() {
  const [step, setStep] = useState<Step>('checking');

  useEffect(() => {
    let active = true;
    void currentStep().then((next) => {
      if (active) setStep(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (step === 'checking') return null;
  const { title, description } = steps[step];
  const connect = () => reloadWithStorageAccess().catch(() => setStep('login'));

  return (
    <section
      aria-labelledby="embedded-session-title"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center"
    >
      <Network aria-hidden className="size-10 text-primary" />
      <h1 id="embedded-session-title" className="font-heading text-xl font-semibold text-ink">
        {title}
      </h1>
      <p className="text-graphite">{description}</p>
      {step === 'permission' ? (
        <Button size="lg" onClick={connect}>
          Conectar
        </Button>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/api/plogin/start"
            target="_blank"
            rel="noopener"
            className={buttonVariants({ size: 'lg' })}
          >
            Ingresar con U-Pasaporte
            <ExternalLink aria-hidden />
          </a>
          <Button size="lg" variant="outline" onClick={connect}>
            Ya ingresé
          </Button>
        </div>
      )}
    </section>
  );
}
