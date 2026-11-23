import 'server-only';

import { NextResponse } from 'next/server';
import {
  authenticateVtiCallback,
  VtiAuthenticationError,
  forgetVtiLoginState,
  startVtiLogin,
  vtiLoginState,
  vtiLoginStateCookie,
} from '@/integrations/vti/server';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
import { forgetAcademicHistory } from '@/integrations/ucampus/server';
import { siteUrl } from '@/shared/server/environment/site-url';
import {
  applicationSessionCookie,
  applicationSessionMaxAge,
  createApplicationSessionToken,
} from '../infrastructure/session';
import { InstitutionalIdentityConflict, reconcileInstitutionalUser } from '../infrastructure/user';

function asApplicationError(error: unknown): never {
  if (error instanceof VtiAuthenticationError) {
    throw new ApplicationError(error.status, error.code, error.message, error.details);
  }
  if (error instanceof InstitutionalIdentityConflict) {
    throw new ApplicationError(
      400,
      'INVALID_AUTH_CALLBACK',
      'No fue posible completar la autenticación.',
      {
        reason: error.reason,
      },
    );
  }
  throw error;
}

export async function startInstitutionalLogin(request: Request) {
  const started = await startVtiLogin();
  if (!started)
    return NextResponse.redirect(siteUrl('/?error=AuthenticationUnavailable', request), 303);

  const response = NextResponse.redirect(started.loginTarget, 303);
  response.cookies.set({ ...vtiLoginStateCookie(request), value: started.state });
  return response;
}

export function completeInstitutionalLogin(request: Request, rawToken: string | null) {
  const state = vtiLoginState(request);
  if (!state || !rawToken?.trim()) {
    return applicationResult(() =>
      Promise.resolve(NextResponse.redirect(siteUrl('/?error=Authentication', request))),
    );
  }

  return applicationResult(async () => {
    const identity = await authenticateVtiCallback(state, rawToken).catch(asApplicationError);
    const user = await reconcileInstitutionalUser(identity).catch(asApplicationError);
    forgetAcademicHistory(user.rut);
    const sessionToken = await createApplicationSessionToken(user.id);
    if (!sessionToken) {
      throw new ApplicationError(
        500,
        'AUTH_CONFIGURATION_ERROR',
        'La autenticación institucional no está disponible.',
      );
    }

    const response = NextResponse.redirect(siteUrl('/academic-overview', request), 303);
    response.cookies.set({
      ...applicationSessionCookie(request),
      value: sessionToken,
      expires: new Date(Date.now() + applicationSessionMaxAge * 1000),
    });
    forgetVtiLoginState(response, request);
    return response;
  });
}
