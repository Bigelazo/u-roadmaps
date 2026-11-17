'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/app/_components/StatusPage';

export type ErrorBoundaryProps = Readonly<{
  error: Error & { digest?: string };
  retry: () => void;
}>;

export function ServerErrorPage({ error }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="No pudimos cargar esta página"
      description="Ocurrió un fallo inesperado. Vuelve a intentarlo más tarde."
    />
  );
}
