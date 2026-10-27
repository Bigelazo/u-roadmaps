import type { RoadmapChangePort } from './change-port';
import { lockRoadmap, roadmapChangeTransaction } from './roadmap-command';
import 'server-only';

import {
  type AcademicHistory,
  type UCampus,
  type MufasaEnrolledCourse,
  type MufasaInstitutionalCoursePosition,
} from '@/integrations/ucampus/server';
import {
  effectivePosition,
  positionCapabilities,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export type AcademicUser = Readonly<{
  id: string;
  name?: string;
  rut: string | null;
  ucampus: UCampus;
}>;

type CourseAccess = Readonly<{
  identifier: CourseOfferingIdentifier;
  name: string;
  positions: readonly MufasaInstitutionalCoursePosition[];
}>;

/** What callers read of the active Participation: its role, its position, and that it is active. */
type ActiveParticipation = Readonly<{
  role: ReturnType<typeof positionCapabilities>['role'];
  institutionalPosition: InstitutionalCoursePosition | null;
  isActive: boolean;
}> | null;

export type CourseOfferingSynchronization =
  | Readonly<{
      status: 'complete';
      position: InstitutionalCoursePosition | null;
      participation: ActiveParticipation;
    }>
  | Readonly<{ status: 'partial' | 'unavailable'; participation: ActiveParticipation }>;

const offeringKey = ({ courseCode, year, semester }: CourseOfferingIdentifier) =>
  `${courseCode}:${year}:${semester}`;

/** Groups the reported section rows into Course offerings, keyed by `offeringKey`. */
function reportedOfferings(courses: readonly MufasaEnrolledCourse[]) {
  const offerings = new Map<string, CourseAccess>();
  for (const course of courses) {
    const key = offeringKey(course);
    const { name, institutionalPosition } = course;
    const access = offerings.get(key) ?? {
      identifier: { courseCode: course.courseCode, year: course.year, semester: course.semester },
      name,
      positions: [],
    };
    offerings.set(key, {
      ...access,
      positions: institutionalPosition
        ? [...access.positions, institutionalPosition]
        : access.positions,
    });
  }
  return offerings;
}

function readActiveParticipation(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
): Promise<ActiveParticipation> {
  return prisma.participation.findFirst({
    where: { userId: user.id, isActive: true, courseOffering: identifier },
  });
}

async function materializeParticipation(
  user: AcademicUser,
  { identifier, ...access }: CourseAccess,
  changePort: RoadmapChangePort,
) {
  const institutionalPosition = effectivePosition(access.positions);
  if (!institutionalPosition) return null;
  const { role } = positionCapabilities(institutionalPosition);
  return roadmapChangeTransaction(
    changePort,
    async (transaction, report) => {
      await transaction.course.createMany({
        data: { code: identifier.courseCode, name: access.name, department: '' },
        skipDuplicates: true,
      });
      await transaction.courseOffering.createMany({ data: identifier, skipDuplicates: true });
      const courseOffering = await transaction.courseOffering.findUniqueOrThrow({
        where: { courseCode_year_semester: identifier },
      });
      const roadmap = await transaction.roadmap.findUnique({
        where: { courseOfferingId: courseOffering.id },
        select: { id: true },
      });
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

async function deactivateParticipations(
  user: AcademicUser,
  isOmitted: (offering: CourseOfferingIdentifier) => boolean,
  changePort: RoadmapChangePort,
) {
  const active = await prisma.participation.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      courseOfferingId: true,
      courseOffering: { select: { courseCode: true, year: true, semester: true } },
    },
  });
  for (const { courseOfferingId, courseOffering } of active) {
    if (!isOmitted(courseOffering)) continue;
    await roadmapChangeTransaction(
      changePort,
      async (transaction) => {
        const roadmap = await transaction.roadmap.findUnique({
          where: { courseOfferingId },
          select: { id: true },
        });
        if (roadmap) await lockRoadmap(transaction, roadmap.id, 'key-share');
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
 * Synchronizes the user's Participation in one Course offering and returns the resulting active
 * one. Only a complete history changes it: a listed offering with a recognized position is
 * materialized, an omitted one is deactivated. Otherwise the stored active Participation stands.
 */
export async function synchronizeCourseOffering(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
): Promise<CourseOfferingSynchronization> {
  const history = await user.ucampus.getAcademicHistory(user.rut);
  if (history.status !== 'complete')
    return {
      status: history.status,
      participation: await readActiveParticipation(user, identifier),
    };
  const key = offeringKey(identifier);
  const access = reportedOfferings(history.courses).get(key);
  if (!access) {
    await deactivateParticipations(user, (offering) => offeringKey(offering) === key, changePort);
    return { status: 'complete', position: null, participation: null };
  }
  const participation =
    (await materializeParticipation(user, access, changePort)) ??
    (await readActiveParticipation(user, identifier));
  return { status: 'complete', position: effectivePosition(access.positions), participation };
}

/**
 * Synchronizes the user's whole Academic history and returns it. Only a complete history changes
 * Participations: every reported Course offering is materialized and every omitted active
 * Participation is deactivated. A partial or unavailable history leaves them unchanged.
 */
export async function synchronizeAcademicHistory(
  user: AcademicUser,
  changePort: RoadmapChangePort,
): Promise<AcademicHistory> {
  const history = await user.ucampus.getAcademicHistory(user.rut);
  if (history.status !== 'complete') return history;
  const offerings = reportedOfferings(history.courses);
  for (const access of offerings.values()) await materializeParticipation(user, access, changePort);
  await deactivateParticipations(
    user,
    (offering) => !offerings.has(offeringKey(offering)),
    changePort,
  );
  return history;
}
