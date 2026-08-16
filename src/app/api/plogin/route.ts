import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { ApiError, apiErrorResponse, handleApiResult, throwApiError } from '@/lib/roadmap-api';
import { normalizeInstitutionalEmail, parseVtiIdentification, requireVtiClaim } from '@/lib/vti';

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

function vtiVerificationOptions() {
  const issuer = process.env.VTI_JWT_ISSUER;
  const audience = process.env.VTI_JWT_AUDIENCE;
  if (!issuer || !audience)
    throw new ApiError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticación institucional no está disponible.',
    );
  return { algorithms: ['HS256'], issuer, audience };
}

function sessionCookieName(request: Request) {
  return isHttps(request) ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

function isHttps(request: Request) {
  const configuredUrl = process.env.NEXTAUTH_URL;
  return configuredUrl
    ? configuredUrl.startsWith('https://')
    : request.headers.get('x-forwarded-proto') === 'https' ||
        new URL(request.url).protocol === 'https:';
}

const sessionMaxAge = 30 * 24 * 60 * 60;

function authenticationErrorResponse(request: Request) {
  const response = NextResponse.redirect(new URL('/auth/signin?error=Authentication', request.url));
  response.cookies.delete(loginStateCookieName);
  return response;
}

export async function POST(request: Request) {
  return handleApiResult(
    async () => {
      const body = await request.formData();
      const rawToken = body.get('jwt');
      const state = body.get('state');
      const expectedState = request.headers
        .get('cookie')
        ?.match(new RegExp(`(?:^|;\\s*)${loginStateCookieName}=([^;]+)`))?.[1];
      if (typeof state !== 'string' || !expectedState || state !== expectedState)
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
        );
      const consumed = await prisma.vtiLoginTransaction.deleteMany({
        where: { state, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1)
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
        );
      if (typeof rawToken !== 'string' || !rawToken.trim())
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
        );

      const verificationSecret = vtiSecret();
      let payload;
      try {
        ({ payload } = await jwtVerify(rawToken, verificationSecret, vtiVerificationOptions()));
        if (typeof payload.exp !== 'number') throw new Error('Missing expiration');
      } catch {
        throw new ApiError(
          400,
          'INVALID_AUTH_CALLBACK',
          'No fue posible completar la autenticación.',
        );
      }
      const identification = parseVtiIdentification(payload.identification).match(
        (value) => value,
        throwApiError,
      );
      const email = normalizeInstitutionalEmail(payload.email).match(
        (value) => value,
        throwApiError,
      );
      const name = requireVtiClaim(payload.name).match((value) => value, throwApiError);
      const preferredUsername =
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username.trim().slice(0, 320)
          : undefined;

      const user = await prisma.$transaction(
        async (transaction) => {
          const byEmail = await transaction.user.findFirst({
            where: { institutionalEmail: { equals: email, mode: 'insensitive' } },
          });
          const byRut = await transaction.user.findUnique({ where: { rut: identification } });
          if (byEmail && byRut && byEmail.id !== byRut.id) {
            throw new ApiError(
              400,
              'INVALID_AUTH_CALLBACK',
              'No fue posible completar la autenticación.',
            );
          }
          if (byEmail?.rut && byEmail.rut !== identification) {
            throw new ApiError(
              400,
              'INVALID_AUTH_CALLBACK',
              'No fue posible completar la autenticación.',
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
      const response = NextResponse.redirect(new URL('/', request.url));
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
      (error.code === 'CONFLICT' && error.source !== 'P2003')
        ? authenticationErrorResponse(request)
        : apiErrorResponse(error),
  );
}
