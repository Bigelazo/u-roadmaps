import type { RoadmapChangePort } from './change-port';
import { lockRoadmap, roadmapChangeTransaction } from './roadmap-command';
import 'server-only';

import {
  type UCampus,
  type MufasaEnrolledCourse,
  type MufasaInstitutionalCoursePosition,
} from '@/integrations/ucampus/server';
import { effectivePosition, positionCapabilities } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export type AcademicUser = Readonly<{
  id: string;
  name?: string;
  rut: string | null;
  ucampus: UCampus;
}>;

export type MufasaCourseAccess = Readonly<{
  name: string;
  positions: readonly MufasaInstitutionalCoursePosition[];
}>;

export type CourseAccessReport = Readonly<{
  access: MufasaCourseAccess | null;
  isComplete: boolean;
}>;

export function canEditRoadmap(access: MufasaCourseAccess) {
  return positionCapabilities(effectivePosition(access.positions)).canEdit;
}

export function academicRole(access: MufasaCourseAccess): 'STUDENT' | 'TEACHER' {
  return canEditRoadmap(access) ? 'TEACHER' : 'STUDENT';
}

const offeringKey = ({ courseCode, year, semester }: CourseOfferingIdentifier) =>
  `${courseCode}:${year}:${semester}`;

export async function readMufasaCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
): Promise<CourseAccessReport> {
  const history = await user.ucampus.getAcademicHistory(user.rut);
  if (history.status !== 'complete') return { access: null, isComplete: false };
  const key = offeringKey(identifier);
  const matches = history.courses.filter((course) => offeringKey(course) === key);
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

export async function applyCourseAccess(
  user: AcademicUser,
  identifier: CourseOfferingIdentifier,
  { access, isComplete }: CourseAccessReport,
  changePort: RoadmapChangePort,
) {
  if (access) return materializeParticipation(user, identifier, access, changePort);
  if (isComplete) {
    const key = offeringKey(identifier);
    await deactivateParticipations(user, (offering) => offeringKey(offering) === key, changePort);
  }
  return null;
}

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

export async function synchronizeAcademicParticipations(
  user: AcademicUser,
  changePort: RoadmapChangePort,
) {
  const history = await user.ucampus.getAcademicHistory(user.rut);
  if (history.status === 'complete') {
    const offerings = new Map<string, MufasaEnrolledCourse[]>();
    for (const course of history.courses) {
      const key = offeringKey(course);
      offerings.set(key, [...(offerings.get(key) ?? []), course]);
    }
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
  return history;
}
