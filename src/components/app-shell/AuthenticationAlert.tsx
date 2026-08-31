'use client';

import { Suspense } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';

function AuthenticationAlertContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pathname !== '/' || searchParams.get('error') !== 'Authentication') return null;

  return (
    <Alert
      aria-label="No fue posible completar la autenticación institucional."
      className="rounded-none border-x-0 border-t-0 border-destructive px-0 py-0"
      variant="destructive"
    >
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-6 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <AlertTitle>No fue posible completar la autenticación institucional.</AlertTitle>
            <AlertDescription>Inténtalo nuevamente.</AlertDescription>
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
