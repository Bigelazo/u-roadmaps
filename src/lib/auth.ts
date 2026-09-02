import {
  canCreateRoadmap,
  getMufasaCourseAccess,
  materializeParticipation,
  synchronizeParticipation,
  type AcademicUser,
} from '@/lib/academic-participation';
import { prisma } from '@/shared/server/db';
import { ApiError, apiResult, type CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { getApplicationSession, resolveSessionUser } from '@/shared/server/session';

async function requireAuthenticatedUserUnsafe() {
  const user = await resolveSessionUser(await getApplicationSession());
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión para continuar.');
  return user;
}

/**
 * Resolves the participation for one course offering. U-Campus is the source
 * of the academic role, so a person who never opened the course, or whose
 * position changed since the last visit, gets the participation refreshed
 * before the operation is refused.
 */
async function resolveParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  courseOfferingId: string,
  allowedRoles: Array<'STUDENT' | 'TEACHER'>,
) {
  const participation = await prisma.participation.findFirst({
    where: { userId: user.id, courseOfferingId, isActive: true },
  });
  if (participation && allowedRoles.includes(participation.role)) return participation;
  const synchronized = await synchronizeParticipation(user, identifier);
  return synchronized && allowedRoles.includes(synchronized.role) ? synchronized : null;
}

async function requireCourseOfferingParticipationUnsafe(
  identifier: CourseOfferingIdentifier,
  allowedRoles: Array<'STUDENT' | 'TEACHER'>,
) {
  const user = await requireAuthenticatedUserUnsafe();
  const courseOffering = await prisma.courseOffering.findUnique({
    where: {
      courseCode_year_semester: identifier,
    },
    include: { roadmap: true },
  });
  if (!courseOffering)
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  const participation = await resolveParticipation(
    user,
    identifier,
    courseOffering.id,
    allowedRoles,
  );
  if (!participation)
    throw new ApiError(403, 'FORBIDDEN', 'No tienes participación vigente para esta operación.');
  return { user, courseOffering, participation };
}

// Crear el roadmap queda reservado a la cátedra y la coordinación del curso.
// Cuando U-Campus no responde, la participación docente vigente sostiene el
// permiso: sin ninguna de las dos, la operación se rechaza.
async function requireRoadmapCreationAccessUnsafe(identifier: CourseOfferingIdentifier) {
  const user = await requireAuthenticatedUserUnsafe();
  const [access, courseOffering] = await Promise.all([
    getMufasaCourseAccess(user, identifier),
    prisma.courseOffering.findUnique({ where: { courseCode_year_semester: identifier } }),
  ]);
  const forbidden = new ApiError(
    403,
    'FORBIDDEN',
    'Solo el profesor de cátedra puede crear el roadmap de este curso.',
  );
  if (access) {
    if (!canCreateRoadmap(access)) throw forbidden;
    await materializeParticipation(user, identifier, access);
    return { user, courseOffering };
  }
  if (!courseOffering) throw forbidden;
  const participation = await prisma.participation.findFirst({
    where: {
      userId: user.id,
      courseOfferingId: courseOffering.id,
      isActive: true,
      role: 'TEACHER',
    },
  });
  if (!participation) throw forbidden;
  return { user, courseOffering };
}

export function requireAuthenticatedUser() {
  return apiResult(requireAuthenticatedUserUnsafe);
}

export function requireCourseOfferingParticipation(
  identifier: CourseOfferingIdentifier,
  allowedRoles: Array<'STUDENT' | 'TEACHER'>,
) {
  return apiResult(() => requireCourseOfferingParticipationUnsafe(identifier, allowedRoles));
}

export function requireRoadmapCreationAccess(identifier: CourseOfferingIdentifier) {
  return apiResult(() => requireRoadmapCreationAccessUnsafe(identifier));
}
