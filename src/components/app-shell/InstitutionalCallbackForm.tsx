'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

// El portal VTI devuelve el token por una redirección GET y el intercambio
// ocurre en `POST /api/plogin`. Este formulario se envía solo al montarse, de
// modo que el ingreso termina sin pasos manuales; el botón queda disponible
// para navegadores sin JavaScript o si el envío automático falla.
let submittedToken: string | null = null;

export default function InstitutionalCallbackForm({ token }: { token: string }) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (submittedToken === token) return;
    submittedToken = token;
    form.current?.requestSubmit();
  }, [token]);

  return (
    <form ref={form} action="/api/plogin" method="post">
      <input name="jwt" type="hidden" value={token} />
      <Button className="mt-6" size="lg" type="submit">
        Continuar
      </Button>
    </form>
  );
}
