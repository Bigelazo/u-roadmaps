'use client';

import { Suspense } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/shared/ui/alert';

const authenticationFailures = {
  Authentication: {
    title: 'No pudimos completar tu ingreso con U-Pasaporte.',
    description:
      'La respuesta de U-Pasaporte expiró o llegó incompleta. Vuelve a ingresar con U-Pasaporte.',
  },
  AuthenticationUnavailable: {
    title: 'El ingreso con U-Pasaporte no está disponible.',
    description:
      'U-Roadmaps no pudo iniciar la conexión con el servicio institucional. Inténtalo más tarde.',
  },
} as const;

function isAuthenticationFailure(
  error: string | null,
): error is keyof typeof authenticationFailures {
  return error !== null && Object.hasOwn(authenticationFailures, error);
}

function AuthenticationAlertContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const error = searchParams.get('error');
  if (pathname !== '/' || !isAuthenticationFailure(error)) return null;
  const { title, description } = authenticationFailures[error];

  return (
    <Alert
      aria-label={title}
      className="rounded-none border-x-0 border-t-0 border-destructive px-0 py-0"
      variant="destructive"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-6 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
          </div>
        </div>
        <AlertAction className="static">
          <Button
            aria-label="Cerrar alerta"
            className="text-destructive hover:text-destructive"
            onClick={() => router.replace('/')}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </AlertAction>
      </div>
    </Alert>
  );
}

export default function AuthenticationAlert() {
  return (
    <Suspense fallback={null}>
      <AuthenticationAlertContent />
    </Suspense>
  );
}
