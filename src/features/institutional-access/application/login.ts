import 'server-only';

import { NextResponse } from 'next/server';
import {
  authenticateVtiCallback,
  VtiAuthenticationError,
  vtiLoginState,
  vtiLoginStateCookieName,
  vtiLoginStateMaxAge,
  startVtiLogin,
} from '@/integrations/vti/server';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
import { isHttps, siteUrl } from '@/shared/server/environment/site-url';
import {
  applicationSessionCookieName,
  applicationSessionMaxAge,
  createApplicationSessionToken,
} from '../infrastructure/session';
import { InstitutionalIdentityConflict, reconcileInstitutionalUser } from '../infrastructure/user';

function asApplicationError(error: unknown): never {
  if (error instanceof VtiAuthenticationError) {
    throw new ApplicationError(error.status, error.code, error.message, error.details);
  }
  if (error instanceof InstitutionalIdentityConflict) {
    throw new ApplicationError(400, 'INVALID_AUTH_CALLBACK', 'No fue posible completar la autenticación.', {
      reason: error.reason,
    });
  }
  throw error;
}

/** Starts VTI without creating a local application session. */
export async function startInstitutionalLogin(request: Request) {
  const started = await startVtiLogin();
  if (!started) return NextResponse.redirect(siteUrl('/?error=Authentication', request), 303);

  const response = NextResponse.redirect(started.loginTarget, 303);
  response.cookies.set({
    name: vtiLoginStateCookieName,
    value: started.state,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(request),
    path: '/',
    maxAge: vtiLoginStateMaxAge,
  });
  return response;
}

/**
 * Validates the VTI callback, reconciles only the local User, and creates the
 * local NextAuth session. Course Participation and its role stay out of this
 * flow and are resolved by the Roadmap authorization path.
 */
export function completeInstitutionalLogin(request: Request, rawToken: FormDataEntryValue | null) {
  const state = vtiLoginState(request);
  if (request.method === 'GET' && (!state || typeof rawToken !== 'string' || !rawToken.trim())) {
    return applicationResult(() =>
      Promise.resolve(NextResponse.redirect(siteUrl('/?error=Authentication', request))),
    );
  }

  return applicationResult(async () => {
    const identity = await authenticateVtiCallback(request, state, rawToken).catch(asApplicationError);
    const user = await reconcileInstitutionalUser(identity).catch(asApplicationError);
    const sessionToken = await createApplicationSessionToken(user.id, identity.preferredUsername);
    if (!sessionToken) {
      throw new ApplicationError(
        500,
        'AUTH_CONFIGURATION_ERROR',
        'La autenticación institucional no está disponible.',
      );
    }

    const response = NextResponse.redirect(siteUrl('/academic-overview', request), 303);
    response.cookies.set({
      name: applicationSessionCookieName(request),
      value: sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isHttps(request),
      maxAge: applicationSessionMaxAge,
      expires: new Date(Date.now() + applicationSessionMaxAge * 1000),
    });
    response.cookies.delete(vtiLoginStateCookieName);
    return response;
  });
}

export function unreadableInstitutionalCallback() {
  return applicationResult(() =>
    Promise.reject(
      new ApplicationError(400, 'INVALID_AUTH_CALLBACK', 'No fue posible completar la autenticación.', {
        reason: 'unreadable-form-body',
      }),
    ),
  );
}
