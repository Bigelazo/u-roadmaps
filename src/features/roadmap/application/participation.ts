import 'server-only';

import {
  canCreateRoadmap,
  getMufasaCourseAccess,
  materializeParticipation,
  synchronizeParticipation,
  type AcademicUser,
} from './academic-participation';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

export { synchronizeParticipation } from './academic-participation';

type ParticipationRole = 'STUDENT' | 'TEACHER';

export type RoadmapActor = AcademicUser;

async function resolveParticipation(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  courseOfferingId: string,
  allowedRoles: readonly ParticipationRole[],
) {
  const participation = await prisma.participation.findFirst({
    where: { userId: actor.id, courseOfferingId, isActive: true },
  });
  if (participation && allowedRoles.includes(participation.role)) return participation;
  const synchronized = await synchronizeParticipation(actor, identifier);
  return synchronized && allowedRoles.includes(synchronized.role) ? synchronized : null;
}

async function requireCourseOfferingParticipationUnsafe(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  allowedRoles: readonly ParticipationRole[],
) {
  const courseOffering = await prisma.courseOffering.findUnique({
    where: { courseCode_year_semester: identifier },
    include: { roadmap: true },
  });
  if (!courseOffering) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  const participation = await resolveParticipation(
    actor,
    identifier,
    courseOffering.id,
    allowedRoles,
  );
  if (!participation) {
    throw new ApplicationError(
      403,
      'FORBIDDEN',
      'No tienes participación vigente para esta operación.',
    );
  }
  return { actor, courseOffering, participation };
}

async function requireRoadmapCreationAccessUnsafe(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
) {
  const [access, courseOffering] = await Promise.all([
    getMufasaCourseAccess(actor, identifier),
    prisma.courseOffering.findUnique({ where: { courseCode_year_semester: identifier } }),
  ]);
  const forbidden = new ApplicationError(
    403,
    'FORBIDDEN',
    'Solo el profesor de cátedra puede crear el roadmap de este curso.',
  );
  if (access) {
    if (!canCreateRoadmap(access)) throw forbidden;
    await materializeParticipation(actor, identifier, access);
    return { actor, courseOffering };
  }
  if (!courseOffering) throw forbidden;
  const participation = await prisma.participation.findFirst({
    where: {
      userId: actor.id,
      courseOfferingId: courseOffering.id,
      isActive: true,
      role: 'TEACHER',
    },
  });
  if (!participation) throw forbidden;
  return { actor, courseOffering };
}

export function requireCourseOfferingParticipation(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  allowedRoles: readonly ParticipationRole[],
) {
  return applicationResult(() =>
    requireCourseOfferingParticipationUnsafe(actor, identifier, allowedRoles),
  );
}

export function requireRoadmapCreationAccess(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
) {
  return applicationResult(() => requireRoadmapCreationAccessUnsafe(actor, identifier));
}
