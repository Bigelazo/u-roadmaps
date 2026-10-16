import type { RoadmapChangePort } from './change-port';
import { roadmapChangeTransaction } from './change-transaction';
import 'server-only';

import {
  getMufasaAcademicCourses,
  type MufasaInstitutionalCoursePosition,
} from '@/integrations/ucampus/server';
import { effectivePosition, positionCapabilities } from '@/shared/institutional-position';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export type AcademicUser = Readonly<{
  id: string;
  name?: string;
  rut: string | null;
  useLocalFixtureData?: boolean;
}>;

export type MufasaCourseAccess = Readonly<{
  name: string;
  positions: readonly MufasaInstitutionalCoursePosition[];
}>;

export function canCreateRoadmap(access: MufasaCourseAccess) {
  return positionCapabilities(effectivePosition(access.positions)).canCreateRoadmap;
}

export function canEditRoadmap(access: MufasaCourseAccess) {
  return positionCapabilities(effectivePosition(access.positions)).canEdit;
}

export function academicRole(access: MufasaCourseAccess): 'STUDENT' | 'TEACHER' {
  return canEditRoadmap(access) ? 'TEACHER' : 'STUDENT';
}

/**
 * Reads the U-Campus positions the person holds in one course offering. A
 * person can appear more than once, for instance teaching one section and
 * assisting another, so every position counts toward the resolved access.
 */
export async function readMufasaCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
): Promise<{ access: MufasaCourseAccess | null; isComplete: boolean }> {
  const mufasa = await getMufasaAcademicCourses(user.rut, {
    useLocalFixtureData: user.useLocalFixtureData === true,
  });
  if (mufasa.source !== 'MUFASA' || mufasa.isComplete === false)
    return { access: null, isComplete: false };
  const matches = mufasa.courses.filter(
    (course) =>
      course.courseCode === identifier.courseCode &&
      course.year === identifier.year &&
      course.semester === identifier.semester,
  );
  if (matches.length === 0) return { access: null, isComplete: true };
  return {
    isComplete: true,
    access: {
      name: matches[0].name,
      positions: matches.flatMap((course) =>
        course.institutionalPosition ? [course.institutionalPosition] : [],
      ),
    },
  };
}

export async function getMufasaCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
) {
  return (await readMufasaCourseAccess(user, identifier)).access;
}

/** Materializes the institutionally reported participation for one offering. */
export async function materializeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  access: MufasaCourseAccess,
  changePort: RoadmapChangePort,
) {
  const institutionalPosition = effectivePosition(access.positions);
  if (!institutionalPosition) return null;
  const { role } = positionCapabilities(institutionalPosition);
  return roadmapChangeTransaction(changePort, async (transaction, report) => {
    // ON CONFLICT DO NOTHING, not an upsert: an upsert reads before it inserts, so
    // concurrent syncs of the same Course (one per offering, or parallel requests)
    // both insert and the second fails with a unique violation.
    await transaction.course.createMany({
      data: { code: identifier.courseCode, name: access.name, department: '' },
      skipDuplicates: true,
    });
    const { courseCode, year, semester } = identifier;
    await transaction.courseOffering.createMany({
      data: { courseCode, year, semester },
      skipDuplicates: true,
    });
    const courseOffering = await transaction.courseOffering.findUniqueOrThrow({
      where: { courseCode_year_semester: { courseCode, year, semester } },
    });
    const roadmap = await transaction.roadmap.findUnique({
      where: { courseOfferingId: courseOffering.id },
      select: { id: true },
    });
    // Match notice delivery's parent -> Participation -> recipient lock order.
    if (roadmap)
      await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmap.id}::uuid FOR KEY SHARE`;
    const [previous] = await transaction.$queryRaw<{ role: string }[]>`
      SELECT role FROM "Participation" WHERE "userId" = ${user.id}::uuid
        AND "courseOfferingId" = ${courseOffering.id}::uuid FOR UPDATE`;
    const participation = await transaction.participation.upsert({
      where: {
        userId_courseOfferingId: { userId: user.id, courseOfferingId: courseOffering.id },
      },
      update: { role, institutionalPosition, isActive: true },
      create: { userId: user.id, courseOfferingId: courseOffering.id, role, institutionalPosition },
    });
    if (previous?.role === 'STUDENT' && role === 'TEACHER' && roadmap) {
      await report({
        actorId: user.id,
        identifier,
        roadmapId: roadmap.id,
        facts: [
          {
            kind: 'participation-role',
            recipientId: user.id,
            previous: 'STUDENT',
            current: 'TEACHER',
          },
        ],
      });
      await transaction.simulatedCompletion.deleteMany({
        where: { participationId: participation.id },
      });
    }
    return participation;
  });
}

/** Resolves and materializes participation when U-Campus grants course access. */
export async function synchronizeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  const access = await getMufasaCourseAccess(user, identifier);
  if (!access) return null;
  return materializeParticipation(user, identifier, access, changePort);
}

/** Synchronize every reported offering once, combining all of its positions. */
export async function synchronizeAcademicParticipations(
  user: AcademicUser,
  changePort: RoadmapChangePort,
) {
  const source = await getMufasaAcademicCourses(user.rut, {
    useLocalFixtureData: user.useLocalFixtureData === true,
  });
  if (source.source === 'MUFASA' && source.isComplete !== false) {
    const offerings = new Map<string, typeof source.courses>();
    for (const course of source.courses) {
      const key = `${course.courseCode}:${course.year}:${course.semester}`;
      offerings.set(key, [...(offerings.get(key) ?? []), course]);
    }
    // Each offering opens an interactive transaction. Await its commit before
    // starting the next so a long academic history cannot flood the pool's queue.
    for (const courses of offerings.values()) {
      const course = courses[0];
      await materializeParticipation(
        user,
        {
          courseCode: course.courseCode,
          year: course.year,
          semester: course.semester,
        },
        {
          name: course.name,
          positions: courses.flatMap(({ institutionalPosition }) =>
            institutionalPosition ? [institutionalPosition] : [],
          ),
        },
        changePort,
      );
    }
  }
  return source;
}
