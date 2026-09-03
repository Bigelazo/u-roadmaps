import 'server-only';

import {
  getMufasaAcademicCourses,
  isCourseLeadPosition,
  type MufasaInstitutionalCoursePosition,
} from '@/integrations/ucampus/server';
import { prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

const roadmapEditingPositions: readonly MufasaInstitutionalCoursePosition[] = [
  'COURSE_PROFESSOR',
  'COORDINATING_PROFESSOR',
  'AUXILIARY_PROFESSOR',
];

export type AcademicUser = Readonly<{
  id: string;
  rut: string | null;
  useLocalFixtureData?: boolean;
}>;

export type MufasaCourseAccess = Readonly<{
  name: string;
  positions: readonly MufasaInstitutionalCoursePosition[];
}>;

export function canCreateRoadmap(access: MufasaCourseAccess) {
  return access.positions.some(isCourseLeadPosition);
}

export function canEditRoadmap(access: MufasaCourseAccess) {
  return access.positions.some((position) => roadmapEditingPositions.includes(position));
}

export function academicRole(access: MufasaCourseAccess): 'STUDENT' | 'TEACHER' {
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
    useLocalFixtureData: user.useLocalFixtureData === true,
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

/** Materializes the institutionally reported participation for one offering. */
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

/** Resolves and materializes participation when U-Campus grants course access. */
export async function synchronizeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
) {
  const access = await getMufasaCourseAccess(user, identifier);
  if (!access) return null;
  return materializeParticipation(user, identifier, access);
}
