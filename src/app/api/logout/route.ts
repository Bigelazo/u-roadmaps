import { NextResponse } from 'next/server';

const authenticationCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  'u-roadmaps-vti-state',
];

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);

  for (const name of authenticationCookieNames) response.cookies.delete(name);

  return response;
}
