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
  return NextResponse.redirect(new URL('/acceso-institucional', request.url));
}

export async function POST(request: Request) {
  const loginTarget = parseLoginUrl(process.env.NEXT_PUBLIC_VTI_LOGIN_URL);
  if (!loginTarget)
    return NextResponse.redirect(new URL('/?error=Authentication', request.url), 303);

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
