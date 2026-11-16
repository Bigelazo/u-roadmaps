'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { StatusPage } from '@/app/_components/StatusPage';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';

export type ErrorBoundaryProps = Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>;

export function ServerErrorPage({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      eyebrow={error.digest ? `Error 500 · ${error.digest}` : 'Error 500'}
      title="No pudimos cargar esta página"
      description="Algo falló de nuestro lado, no en lo que hiciste. Intenta de nuevo en unos segundos; si vuelve a fallar, vuelve al inicio y entra otra vez."
    >
      <Button size="lg" onClick={retry}>
        Intentar de nuevo
      </Button>
      <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        Ir al inicio
      </Link>
    </StatusPage>
  );
}
