import {
  completeInstitutionalLogin,
  unreadableInstitutionalCallback,
} from '@/features/institutional-access/server';

export const dynamic = 'force-dynamic';

// El portal VTI devuelve el token por una redirección GET. La transacción de
// un solo uso creada por `/api/plogin/start` protege este callback, por lo que
// el servidor puede completar la sesión y llevar a la persona directamente a
// su resumen académico sin una página intermedia.
export async function GET(request: Request) {
  const rawToken = new URL(request.url).searchParams.get('jwt');
  return completeInstitutionalLogin(request, rawToken);
}

export async function POST(request: Request) {
  let rawToken: FormDataEntryValue | null;
  try {
    rawToken = (await request.formData()).get('jwt');
  } catch {
    return unreadableInstitutionalCallback(request);
  }
  return completeInstitutionalLogin(request, rawToken);
}
