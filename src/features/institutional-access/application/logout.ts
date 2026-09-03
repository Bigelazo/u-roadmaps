import 'server-only';

import { NextResponse } from 'next/server';
import { vtiLoginStateCookieName } from '@/integrations/vti/server';
import { siteUrl } from '@/shared/server/environment/site-url';

const authenticationCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  vtiLoginStateCookieName,
];

/** Ends the local U-Roadmaps session; ADR-0005 defers VTI SSO logout. */
export function endInstitutionalSession(request: Request) {
  const response = NextResponse.redirect(siteUrl('/', request), 303);
  for (const name of authenticationCookieNames) response.cookies.delete(name);
  return response;
}
