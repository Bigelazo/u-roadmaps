import 'server-only';

import type { Session } from 'next-auth';
import { getApplicationSession } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { isUuid } from '@/shared/validation';
import { ApplicationError } from '@/shared/errors/server';
import { createMufasaUCampus, localFixtureUCampus } from '@/integrations/ucampus/server';

export async function resolveSessionUser(session: Session | null) {
  const userId = session?.user?.id;
  if (!isUuid(userId)) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return (
    user && {
      ...user,
      ucampus:
        session?.user?.useLocalFixtureData === true ? localFixtureUCampus : createMufasaUCampus(),
    }
  );
}

export async function requireAuthenticatedUser() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) {
    throw new ApplicationError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  }
  return user;
}
