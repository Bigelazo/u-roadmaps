import {
  completeInstitutionalLogin,
  unreadableInstitutionalCallback,
} from '@/features/institutional-access/server';
import { NextResponse } from 'next/server';
import { applicationErrorResponse } from '@/app/_adapters/http';
import type { ApplicationError, ApplicationResult } from '@/shared/errors/types';
import { siteUrl } from '@/shared/server/environment/site-url';
import { vtiLoginStateCookieName } from '@/integrations/vti/server';

export const dynamic = 'force-dynamic';

function authenticationErrorResponse(request: Request, error: ApplicationError) {
  console.error('[plogin] autenticación rechazada', error.code, error.details ?? {});
  const response = NextResponse.redirect(siteUrl('/?error=Authentication', request), 303);
  response.cookies.delete(vtiLoginStateCookieName);
  return response;
}

async function resolveInstitutionalLogin(
  request: Request,
  result: Promise<Awaited<ApplicationResult<Response>>>,
) {
  return (await result).match(
    (response) => response,
    (error) =>
      error.code === 'INVALID_AUTH_CALLBACK' ||
      error.code === 'INVALID_VTI_CLAIMS' ||
      error.code === 'AUTH_CONFIGURATION_ERROR' ||
      (error.code === 'CONFLICT' && error.source !== 'P2003')
        ? authenticationErrorResponse(request, error)
        : applicationErrorResponse(error),
  );
}

// El portal VTI devuelve el token por una redirección GET. La transacción de
// un solo uso creada por `/api/plogin/start` protege este callback, por lo que
// el servidor puede completar la sesión y llevar a la persona directamente a
// su resumen académico sin una página intermedia.
export async function GET(request: Request) {
  const rawToken = new URL(request.url).searchParams.get('jwt');
  return resolveInstitutionalLogin(request, completeInstitutionalLogin(request, rawToken));
}

export async function POST(request: Request) {
  let rawToken: FormDataEntryValue | null;
  try {
    rawToken = (await request.formData()).get('jwt');
  } catch {
    return resolveInstitutionalLogin(request, unreadableInstitutionalCallback());
  }
  return resolveInstitutionalLogin(request, completeInstitutionalLogin(request, rawToken));
}
