import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { ApiError, apiErrorResponse, handleApiResult } from '@/lib/roadmap-api';
import { isHttps, siteOrigin, siteUrl } from '@/lib/site-url';
import {
  invalidVtiClaims,
  normalizeInstitutionalEmail,
  parseVtiIdentification,
  requireVtiClaim,
} from '@/lib/vti-claims';

export const dynamic = 'force-dynamic';

const loginStateCookieName = 'u-roadmaps-vti-state';

function vtiSecret() {
  const secret = process.env.VTI_JWT_SECRET;
  if (!secret)
    throw new ApiError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticación institucional no está disponible.',
    );
  return new TextEncoder().encode(secret);
}

function sessionCookieName(request: Request) {
  return isHttps(request) ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

function isCrossSiteRequest(request: Request) {
  const origin = request.headers.get('origin');
  return origin !== null && origin !== siteOrigin(request).origin;
}

function loginState(request: Request) {
  return request.headers
    .get('cookie')
    ?.match(new RegExp(`(?:^|;\\s*)${loginStateCookieName}=([^;]+)`))?.[1];
}

const sessionMaxAge = 30 * 24 * 60 * 60;

function authenticationErrorResponse(request: Request, error: ApiError) {
  console.error('[plogin] autenticación rechazada', error.code, error.details ?? {});
  const response = NextResponse.redirect(siteUrl('/?error=Authentication', request), 303);
  response.cookies.delete(loginStateCookieName);
  return response;
}

// El portal VTI devuelve el token por redirección GET, sin repetir el `state`
// ni emitir `iss`, `aud` o `exp`. Este GET no muta estado: valida el estado
// pendiente y delega en la página de acceso institucional, cuyo formulario
// ejecuta el intercambio en el POST. La transacción de un solo uso creada por
// `/api/plogin/start` acota la ventana de reuso a diez minutos.
export async function GET(request: Request) {
  const rawToken = new URL(request.url).searchParams.get('jwt');
  if (!loginState(request) || typeof rawToken !== 'string' || !rawToken.trim())
    return NextResponse.redirect(siteUrl('/?error=Authentication', request));
  const target = siteUrl('/acceso-institucional', request);
  target.searchParams.set('jwt', rawToken);
  return NextResponse.redirect(target);
}

export async function POST(request: Request) {
  return handleApiResult(
    async () => {
      if (isCrossSiteRequest(request))
        throw new ApiError(
          403,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          {
            reason: 'cross-site-origin',
            origin: request.headers.get('origin'),
            expected: siteOrigin(request).origin,
          },
        );
      let rawToken: FormDataEntryValue | null;
      try {
        rawToken = (await request.formData()).get('jwt');
      } catch {
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          { reason: 'unreadable-form-body' },
        );
      }
      const state = loginState(request);
      if (!state)
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          { reason: 'missing-state-cookie' },
        );
      const consumed = await prisma.vtiLoginTransaction.deleteMany({
        where: { state, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1)
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          { reason: 'unknown-or-expired-state' },
        );
      if (typeof rawToken !== 'string' || !rawToken.trim())
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          { reason: 'missing-token' },
        );

      const verificationSecret = vtiSecret();
      let payload;
      try {
        ({ payload } = await jwtVerify(rawToken, verificationSecret, { algorithms: ['HS256'] }));
      } catch {
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
          { reason: 'invalid-token-signature' },
        );
      }
      const invalidClaimsError = (claim: string): never => {
        throw new ApiError(
          400,
          invalidVtiClaims,
          'No fue posible validar la identidad institucional.',
          { reason: 'invalid-claim', claim },
        );
      };
      const identification = parseVtiIdentification(payload.identification).match(
        (value) => value,
        () => invalidClaimsError('identification'),
      );
      const email = normalizeInstitutionalEmail(payload.email).match(
        (value) => value,
        () => invalidClaimsError('email'),
      );
      const name = requireVtiClaim(payload.name).match(
        (value) => value,
        () => invalidClaimsError('name'),
      );
      const preferredUsername =
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username.trim().slice(0, 320)
          : undefined;

      const user = await prisma.$transaction(
        async (transaction) => {
          const [byEmail, byRut] = await Promise.all([
            transaction.user.findFirst({
              where: { institutionalEmail: { equals: email, mode: 'insensitive' } },
            }),
            transaction.user.findUnique({ where: { rut: identification } }),
          ]);
          if (byEmail && byRut && byEmail.id !== byRut.id) {
            throw new ApiError(
              400,
              'INVALID_AUTH_CALLBACK',
              'No fue posible completar la autenticación.',
              { reason: 'identity-already-linked' },
            );
          }
          if (byEmail?.rut && byEmail.rut !== identification) {
            throw new ApiError(
              400,
              'INVALID_AUTH_CALLBACK',
              'No fue posible completar la autenticación.',
              { reason: 'identification-mismatch' },
            );
          }

          const existing = byEmail ?? byRut;
          if (!existing)
            return transaction.user.create({
              data: { name, institutionalEmail: email, rut: identification },
            });
          return transaction.user.update({
            where: { id: existing.id },
            data: {
              ...(existing.name !== name ? { name } : {}),
              ...(existing.rut ? {} : { rut: identification }),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const secret = authOptions.secret;
      if (!secret)
        throw new ApiError(
          500,
          'AUTH_CONFIGURATION_ERROR',
          'La autenticación institucional no está disponible.',
        );
      const sessionToken = await encode({
        token: {
          sub: user.id,
          ...(preferredUsername ? { preferred_username: preferredUsername } : {}),
        },
        secret,
        maxAge: sessionMaxAge,
      });
      const response = NextResponse.redirect(siteUrl('/', request), 303);
      response.cookies.set({
        name: sessionCookieName(request),
        value: sessionToken,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isHttps(request),
        maxAge: sessionMaxAge,
        expires: new Date(Date.now() + sessionMaxAge * 1000),
      });
      response.cookies.delete(loginStateCookieName);
      return response;
    },
    (error) =>
      error.code === 'INVALID_AUTH_CALLBACK' ||
      error.code === 'INVALID_VTI_CLAIMS' ||
      error.code === 'AUTH_CONFIGURATION_ERROR' ||
      (error.code === 'CONFLICT' && error.source !== 'P2003')
        ? authenticationErrorResponse(request, error)
        : apiErrorResponse(error),
  );
}
