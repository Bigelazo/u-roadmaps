'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function AuthenticationAlert() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pathname !== '/' || searchParams.get('error') !== 'Authentication') return null;

  return (
    <div
      className="border-b border-red-200 bg-red-50 text-[#8d2024]"
      role="alert"
      aria-label="No fue posible completar la autenticación institucional."
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-3 text-sm font-medium">
        <p>No fue posible completar la autenticación institucional. Inténtalo nuevamente.</p>
        <Button
          aria-label="Cerrar alerta"
          className="ml-auto text-[#8d2024] hover:bg-red-100 hover:text-[#8d2024]"
          onClick={() => router.replace('/')}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
