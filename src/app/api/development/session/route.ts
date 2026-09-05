import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { authOptions } from '@/shared/server/session';
import { fixtureEnvironmentEnabled } from '@/shared/server/environment/development';
import { developmentPersonas } from '@/development';
import { prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/types';
import { handleApplicationResult, parseJsonObject, requireUuid } from '@/app/_adapters/http';

export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    if (!fixtureEnvironmentEnabled()) {
      throw new ApplicationError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    }
    const userId = requireUuid((await parseJsonObject(request)).userId, 'userId');
    if (!developmentPersonas.some((persona) => persona.id === userId)) {
      throw new ApplicationError(
        404,
        'DEVELOPMENT_PERSONA_NOT_FOUND',
        'La persona de desarrollo no existe.',
      );
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new ApplicationError(
        404,
        'DEVELOPMENT_PERSONA_NOT_FOUND',
        'La persona de desarrollo no existe.',
      );
    if (!authOptions.secret)
      throw new ApplicationError(500, 'AUTH_CONFIGURATION_ERROR', 'La sesión no está configurada.');
    const token = await encode({
      token: { sub: user.id, useLocalFixtureData: true },
      secret: authOptions.secret,
      maxAge: 30 * 24 * 60 * 60,
    });
    const response = NextResponse.json({ user: { id: user.id, name: user.name } });
    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  });
}
