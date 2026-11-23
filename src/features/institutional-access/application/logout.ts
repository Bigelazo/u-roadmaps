import 'server-only';

import { NextResponse } from 'next/server';
import { vtiLoginStateCookieNames } from '@/integrations/vti/server';
import { siteUrl } from '@/shared/server/environment/site-url';
import { getApplicationSession } from '@/shared/server/session';
import { isUuid } from '@/shared/validation';
import { revokeUserSessions } from '../infrastructure/user';

const authenticationCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  ...vtiLoginStateCookieNames,
];

export async function endInstitutionalSession(request: Request) {
  try {
    const userId = (await getApplicationSession())?.user?.id;
    if (isUuid(userId)) await revokeUserSessions(userId);
  } catch (error) {
    console.error('[logout] no se pudieron revocar las sesiones', error);
  }
  const response = NextResponse.redirect(siteUrl('/', request), 303);
  for (const name of authenticationCookieNames) {
    if (name.startsWith('__Secure-') || name.startsWith('__Host-')) {
      response.cookies.set({ name, value: '', path: '/', secure: true, maxAge: 0 });
    } else {
      response.cookies.delete(name);
    }
  }
  return response;
}
