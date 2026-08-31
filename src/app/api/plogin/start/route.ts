import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isHttps, siteUrl } from '@/lib/site-url';

const loginStateCookieName = 'u-roadmaps-vti-state';
const loginStateMaxAge = 10 * 60;

function parseLoginUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// Navegaciones de solo lectura (redirecciones de rutas protegidas y la página
// `signIn` de NextAuth) aterrizan aquí y delegan en la página de acceso
// institucional, cuyo formulario inicia el flujo con POST.
export async function GET(request: Request) {
  return NextResponse.redirect(siteUrl('/acceso-institucional', request));
}

export async function POST(request: Request) {
  const loginTarget = parseLoginUrl(process.env.NEXT_PUBLIC_VTI_LOGIN_URL);
  if (!loginTarget) return NextResponse.redirect(siteUrl('/?error=Authentication', request), 303);

  const state = crypto.randomUUID();
  await prisma.vtiLoginTransaction.create({
    data: { state, expiresAt: new Date(Date.now() + loginStateMaxAge * 1000) },
  });
  loginTarget.searchParams.set('state', state);
  const response = NextResponse.redirect(loginTarget, 303);
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
