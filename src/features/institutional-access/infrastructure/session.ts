import 'server-only';

import { encode } from 'next-auth/jwt';
import { authOptions } from '@/shared/server/session';
import { isHttps } from '@/shared/server/environment/site-url';

export const applicationSessionMaxAge = 30 * 24 * 60 * 60;

export function applicationSessionCookieName(request: Request) {
  return isHttps(request) ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

export async function createApplicationSessionToken(
  userId: string,
  preferredUsername: string | undefined,
) {
  const secret = authOptions.secret;
  if (!secret) return null;

  return encode({
    token: {
      sub: userId,
      ...(preferredUsername ? { preferred_username: preferredUsername } : {}),
    },
    secret,
    maxAge: applicationSessionMaxAge,
  });
}
