import 'server-only';

import { encode } from 'next-auth/jwt';
import { authOptions } from '@/shared/server/session';
import { isHttps } from '@/shared/server/environment/site-url';

export const applicationSessionMaxAge = 30 * 24 * 60 * 60;

export function applicationSessionCookieName(request: Request) {
  return isHttps(request) ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

export function applicationSessionCookie(request: Request) {
  const secure = isHttps(request);
  return {
    name: applicationSessionCookieName(request),
    httpOnly: true,
    sameSite: secure ? ('none' as const) : ('lax' as const),
    path: '/',
    secure,
    maxAge: applicationSessionMaxAge,
  };
}

export async function createApplicationSessionToken(userId: string) {
  const secret = authOptions.secret;
  if (!secret) return null;

  return encode({
    token: { sub: userId },
    secret,
    maxAge: applicationSessionMaxAge,
  });
}
