import type { ParticipationRole } from '@/generated/prisma/client';
import { prisma } from '@/shared/server/db';
import { isDevelopmentPersona } from '@/lib/development';
import { getMufasaAcademicCourses, type MufasaInstitutionalCoursePosition } from '@/lib/mufasa';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';

// U-Campus es la fuente de los cargos y `Participation` solo distingue entre
// edición y lectura. La cátedra y la coordinación crean el roadmap del curso;
// los auxiliares lo editan. Ayudantes, oyentes y estudiantes lo leen.
const roadmapCreationPositions: readonly MufasaInstitutionalCoursePosition[] = [
  'COURSE_PROFESSOR',
  'COORDINATING_PROFESSOR',
];
const roadmapEditingPositions: readonly MufasaInstitutionalCoursePosition[] = [
  ...roadmapCreationPositions,
  'AUXILIARY_PROFESSOR',
];

export type AcademicUser = Readonly<{ id: string; rut: string | null }>;

export type MufasaCourseAccess = Readonly<{
  name: string;
  positions: readonly MufasaInstitutionalCoursePosition[];
}>;

export function isRoadmapCreationPosition(position: MufasaInstitutionalCoursePosition | null) {
  return position !== null && roadmapCreationPositions.includes(position);
}

export function isRoadmapEditingPosition(position: MufasaInstitutionalCoursePosition | null) {
  return position !== null && roadmapEditingPositions.includes(position);
}

export function canCreateRoadmap(access: MufasaCourseAccess) {
  return access.positions.some(isRoadmapCreationPosition);
}

export function canEditRoadmap(access: MufasaCourseAccess) {
  return access.positions.some(isRoadmapEditingPosition);
}

export function academicRole(access: MufasaCourseAccess): ParticipationRole {
  return canEditRoadmap(access) ? 'TEACHER' : 'STUDENT';
}

/**
 * Reads the U-Campus positions the person holds in one course offering. A
 * person can appear more than once, for instance teaching one section and
 * assisting another, so every position counts toward the resolved access.
 */
export async function getMufasaCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
): Promise<MufasaCourseAccess | null> {
  const mufasa = await getMufasaAcademicCourses(user.rut, {
    useLocalFixtureData: isDevelopmentPersona(user.id),
  });
  if (mufasa.source !== 'MUFASA') return null;
  const matches = mufasa.courses.filter(
    (course) =>
      course.courseCode === identifier.courseCode &&
      course.year === identifier.year &&
      course.semester === identifier.semester,
  );
  if (matches.length === 0) return null;
  return {
    name: matches[0].name,
    positions: matches.flatMap((course) =>
      course.institutionalPosition ? [course.institutionalPosition] : [],
    ),
  };
}

/**
 * Materializes the course offering and the participation that U-Campus
 * reports. The course keeps the name and department it already has, because
 * U-Campus does not carry the curated description shown in the overview.
 */
export async function materializeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  access: MufasaCourseAccess,
) {
  const role = academicRole(access);
  return prisma.$transaction(async (transaction) => {
    await transaction.course.upsert({
      where: { code: identifier.courseCode },
      update: {},
      create: { code: identifier.courseCode, name: access.name, department: '' },
    });
    const courseOffering = await transaction.courseOffering.upsert({
      where: { courseCode_year_semester: identifier },
      update: {},
      create: {
        courseCode: identifier.courseCode,
        year: identifier.year,
        semester: identifier.semester,
      },
    });
    return transaction.participation.upsert({
      where: {
        userId_courseOfferingId: { userId: user.id, courseOfferingId: courseOffering.id },
      },
      update: { role, isActive: true },
      create: { userId: user.id, courseOfferingId: courseOffering.id, role },
    });
  });
}

/**
 * Resolves the participation that authorizes a course operation, creating it
 * from the U-Campus position when the person has never opened the course.
 * Returns null when U-Campus does not place the person in the offering.
 */
export async function synchronizeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
) {
  const access = await getMufasaCourseAccess(user, identifier);
  if (!access) return null;
  return materializeParticipation(user, identifier, access);
}
