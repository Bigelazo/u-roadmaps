import 'server-only';

import { cache } from 'react';
import type { Session } from 'next-auth';
import { getApplicationSession } from '@/shared/server/session';
import { prisma } from '@/shared/server/db';
import { isUuid } from '@/shared/validation';
import { ApplicationError } from '@/shared/errors/server';
import { readFixtureParticipantNames } from '@/development/server';
import { createMufasaUCampus, localFixtureUCampus } from '@/integrations/ucampus/server';
import { synchronizeCourseOffering } from '@/features/roadmap/server';
import type { CourseOfferingIdentifier } from '@/shared/course-offering';
import { roadmapChangePort } from './roadmap-changes';

const readUserOncePerRequest = cache((userId: string) =>
  prisma.user.findUnique({ where: { id: userId } }),
);

export async function resolveSessionUser(
  session: Session | null,
  { sharedAcademicHistory = false }: { sharedAcademicHistory?: boolean } = {},
) {
  const userId = session?.user?.id;
  if (!isUuid(userId)) return null;
  const user = await readUserOncePerRequest(userId);
  return (
    user && {
      ...user,
      ucampus:
        session?.user?.useLocalFixtureData === true
          ? { ...localFixtureUCampus, getPersonNames: readFixtureParticipantNames }
          : createMufasaUCampus({ sharedAcademicHistory }),
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

export async function synchronizeSessionParticipation(identifier: CourseOfferingIdentifier) {
  const user = await resolveSessionUser(await getApplicationSession(), {
    sharedAcademicHistory: true,
  });
  if (user) await synchronizeCourseOffering(user, identifier, roadmapChangePort);
}
