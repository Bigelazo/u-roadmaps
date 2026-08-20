import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const loginStateCookieName = 'u-roadmaps-vti-state';
const loginStateMaxAge = 10 * 60;

function isHttps(request: Request) {
  const configuredUrl = process.env.NEXTAUTH_URL;
  return configuredUrl
    ? configuredUrl.startsWith('https://')
    : request.headers.get('x-forwarded-proto') === 'https' ||
        new URL(request.url).protocol === 'https:';
}

export async function GET(request: Request) {
  const loginUrl = process.env.NEXT_PUBLIC_VTI_LOGIN_URL;
  if (!loginUrl) return NextResponse.redirect(new URL('/?error=Authentication', request.url));

  const state = crypto.randomUUID();
  await prisma.vtiLoginTransaction.create({
    data: { state, expiresAt: new Date(Date.now() + loginStateMaxAge * 1000) },
  });
  const target = new URL(loginUrl);
  target.searchParams.set('state', state);
  const response = NextResponse.redirect(target);
  response.cookies.set({
    name: loginStateCookieName,
    value: state,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(request),
    path: '/',
    maxAge: loginStateMaxAge,
  });
  return response;
}
