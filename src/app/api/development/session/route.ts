import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { authOptions } from '@/shared/server/session';
import { fixtureEnvironmentEnabled } from '@/shared/server/environment/development';
import { developmentPersonas } from '@/lib/development';
import { prisma } from '@/shared/server/db';
import { ApiError, handleApiResult, parseJson, requireUuid } from '@/lib/roadmap-api';

export async function POST(request: Request) {
  return handleApiResult(async () => {
    if (!fixtureEnvironmentEnabled()) {
      throw new ApiError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    }
    const userId = requireUuid((await parseJson(request)).userId, 'userId');
    if (!developmentPersonas.some((persona) => persona.id === userId)) {
      throw new ApiError(
        404,
        'DEVELOPMENT_PERSONA_NOT_FOUND',
        'La persona de desarrollo no existe.',
      );
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new ApiError(
        404,
        'DEVELOPMENT_PERSONA_NOT_FOUND',
        'La persona de desarrollo no existe.',
      );
    if (!authOptions.secret)
      throw new ApiError(500, 'AUTH_CONFIGURATION_ERROR', 'La sesión no está configurada.');
    const token = await encode({
      token: { sub: user.id },
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
