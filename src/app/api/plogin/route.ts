import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { ApiError, apiErrorResponse } from '@/lib/roadmap-api';
import { normalizeInstitutionalEmail, parseVtiIdentification, requireVtiClaim } from '@/lib/vti';

export const dynamic = 'force-dynamic';

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

function isHttps(request: Request) {
  const configuredUrl = process.env.NEXTAUTH_URL;
  return configuredUrl
    ? configuredUrl.startsWith('https://')
    : request.headers.get('x-forwarded-proto') === 'https' ||
    new URL(request.url).protocol === 'https:';
}

const sessionMaxAge = 30 * 24 * 60 * 60;

function authenticationErrorResponse(request: Request) {
  return NextResponse.redirect(new URL('/auth/signin?error=Authentication', request.url));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawToken = url.searchParams.get('jwt');
    if (!rawToken?.trim())
      throw new ApiError(
        400,
        'INVALID_AUTH_CALLBACK',
        'No fue posible completar la autenticación.',
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
      );
    }
    const identification = parseVtiIdentification(payload.identification);
    const email = normalizeInstitutionalEmail(payload.email);
    const name = requireVtiClaim(payload.name);
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
    return response;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === 'INVALID_AUTH_CALLBACK' || error.code === 'INVALID_VTI_CLAIMS')
    ) {
      return authenticationErrorResponse(request);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return authenticationErrorResponse(request);
    }
    return apiErrorResponse(error);
  }
}
