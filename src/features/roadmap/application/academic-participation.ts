import type { RoadmapChangePort } from './change-port';
import { lockRoadmap, roadmapChangeTransaction } from './roadmap-command';
import 'server-only';

import {
  getMufasaAcademicCourses,
  type MufasaInstitutionalCoursePosition,
} from '@/integrations/ucampus/server';
import { effectivePosition, positionCapabilities } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
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

export function canEditRoadmap(access: MufasaCourseAccess) {
  return positionCapabilities(effectivePosition(access.positions)).canEdit;
}

export function academicRole(access: MufasaCourseAccess): 'STUDENT' | 'TEACHER' {
  return canEditRoadmap(access) ? 'TEACHER' : 'STUDENT';
}

/** One equality rule for Course offerings, shared by materialization and omission. */
const offeringKey = ({ courseCode, year, semester }: CourseOfferingIdentifier) =>
  `${courseCode}:${year}:${semester}`;

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
  const key = offeringKey(identifier);
  const matches = mufasa.courses.filter((course) => offeringKey(course) === key);
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
  return roadmapChangeTransaction(
    changePort,
    async (transaction, report) => {
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
      if (roadmap) await lockRoadmap(transaction, roadmap.id, 'key-share');
      const [previous] = await transaction.$queryRaw<{ role: string }[]>`
      SELECT role FROM "Participation" WHERE "userId" = ${user.id}::uuid
        AND "courseOfferingId" = ${courseOffering.id}::uuid FOR UPDATE`;
      const participation = await transaction.participation.upsert({
        where: {
          userId_courseOfferingId: { userId: user.id, courseOfferingId: courseOffering.id },
        },
        update: { role, institutionalPosition, isActive: true },
        create: {
          userId: user.id,
          courseOfferingId: courseOffering.id,
          role,
          institutionalPosition,
        },
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
    },
    { isolation: 'read-committed' },
  );
}

/**
 * Deactivates the user's active Participations in the offerings a complete U-Campus report
 * omits. The Participations and their Completions stay; the notice lifecycle withdraws
 * pending notices when a Participation stops being active (ADR-0024). Like activation, a
 * loss reports no fact: access snapshots and notice audiences read only active ones.
 */
async function deactivateParticipations(
  user: AcademicUser,
  isOmitted: (offering: CourseOfferingIdentifier) => boolean,
  changePort: RoadmapChangePort,
) {
  const active = await prisma.participation.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      courseOfferingId: true,
      courseOffering: {
        select: { courseCode: true, year: true, semester: true, roadmap: { select: { id: true } } },
      },
    },
  });
  for (const { courseOfferingId, courseOffering } of active) {
    if (!isOmitted(courseOffering)) continue;
    await roadmapChangeTransaction(
      changePort,
      async (transaction) => {
        // Match notice delivery's parent -> Participation -> recipient lock order.
        if (courseOffering.roadmap)
          await lockRoadmap(transaction, courseOffering.roadmap.id, 'key-share');
        await transaction.participation.updateMany({
          where: { userId: user.id, courseOfferingId, isActive: true },
          data: { isActive: false },
        });
      },
      { isolation: 'read-committed' },
    );
  }
}

/**
 * Applies one offering's U-Campus answer: materializes the reported access or, when a
 * complete report omits the offering, deactivates its Participation. A complete report
 * answers for one offering as authoritatively as for the whole history.
 */
export async function applyCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  { access, isComplete }: Awaited<ReturnType<typeof readMufasaCourseAccess>>,
  changePort: RoadmapChangePort,
) {
  if (access) return materializeParticipation(user, identifier, access, changePort);
  if (isComplete) {
    const key = offeringKey(identifier);
    await deactivateParticipations(user, (offering) => offeringKey(offering) === key, changePort);
  }
  return null;
}

/** Brings the user's Participation in one offering in line with U-Campus. */
export async function synchronizeParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  return applyCourseAccess(
    user,
    identifier,
    await readMufasaCourseAccess(user, identifier),
    changePort,
  );
}

/**
 * Synchronizes every reported offering once, combining all of its positions. A complete
 * report lists the whole academic history (every period), so it also deactivates the
 * Participations it no longer contains.
 */
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
      const key = offeringKey(course);
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
    await deactivateParticipations(
      user,
      (offering) => !offerings.has(offeringKey(offering)),
      changePort,
    );
  }
  return source;
}
