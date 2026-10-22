import 'server-only';

import {
  getMufasaAcademicCourses,
  getMufasaCourseMembers,
  getMufasaPersonNames,
} from '@/integrations/ucampus/server';
import {
  effectivePosition,
  positionCapabilities,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import {
  averageStudentCompletion,
  compareCourseMembers,
  completionRatio,
} from '../domain/course-progress';
import type { CourseOfferingIdentifier } from '../types';
import type { RoadmapActor } from './participation';
import { roadmapRead } from './roadmap-command';

export type CourseMember = Readonly<{
  key: string;
  name: string;
  sections: string[];
  institutionalPosition: InstitutionalCoursePosition | null;
  hasEntered: boolean;
  completedNodes: number | null;
  completion: number | null;
}>;

export type CourseParticipants = Readonly<{
  course: Readonly<CourseOfferingIdentifier & { name: string }>;
  source: 'MUFASA' | 'LOCAL';
  hasRoadmap: boolean;
  visibleNodes: number;
  studentCount: number;
  averageStudentCompletion: number | null;
  teachingStaff: CourseMember[];
  students: CourseMember[];
}>;

type RosterEntry = Readonly<{
  key: string;
  name: string;
  userId: string | null;
  sections: string[];
  institutionalPosition: InstitutionalCoursePosition | null;
  isTeachingStaff: boolean;
}>;

function compareSections(a: string, b: string) {
  return a.localeCompare(b, 'es-CL', { numeric: true });
}

async function readInstitutionalRoster(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
): Promise<RosterEntry[] | null> {
  const options = { useLocalFixtureData: actor.useLocalFixtureData === true };
  const { courses } = await getMufasaAcademicCourses(actor.rut, options);
  const ramoId = courses.find(
    (course) =>
      course.courseCode === identifier.courseCode &&
      course.year === identifier.year &&
      course.semester === identifier.semester &&
      course.ramoId !== null,
  )?.ramoId;
  if (!ramoId) return null;
  const roster = await getMufasaCourseMembers(ramoId, identifier, options);
  if (roster.source !== 'MUFASA' || roster.members.length === 0) return null;

  const byRut = new Map<
    string,
    { sections: Set<string>; positions: InstitutionalCoursePosition[] }
  >();
  for (const member of roster.members) {
    const entry = byRut.get(member.rut) ?? { sections: new Set<string>(), positions: [] };
    if (member.section) entry.sections.add(member.section);
    entry.positions.push(member.institutionalPosition);
    byRut.set(member.rut, entry);
  }
  const ruts = [...byRut.keys()];
  const [localUsers, names] = await Promise.all([
    prisma.user.findMany({
      where: { rut: { in: ruts } },
      select: { id: true, name: true, rut: true },
    }),
    getMufasaPersonNames(ruts, options),
  ]);
  const usersByRut = new Map(localUsers.map((user) => [user.rut, user]));
  return [...byRut].map(([rut, { sections, positions }]) => {
    const institutionalPosition = effectivePosition(positions);
    const localUser = usersByRut.get(rut);
    return {
      key: rut,
      name: names.get(rut) ?? localUser?.name ?? `RUT ${rut}`,
      userId: localUser?.id ?? null,
      sections: [...sections].sort(compareSections),
      institutionalPosition,
      isTeachingStaff: positionCapabilities(institutionalPosition).isTeachingStaff,
    };
  });
}

async function readLocalRoster(courseOfferingId: string): Promise<RosterEntry[]> {
  const participations = await prisma.participation.findMany({
    where: { courseOfferingId, isActive: true },
    select: {
      role: true,
      institutionalPosition: true,
      user: { select: { id: true, name: true } },
    },
  });
  return participations.map(({ role, institutionalPosition, user }) => ({
    key: user.id,
    name: user.name,
    userId: user.id,
    sections: [],
    institutionalPosition: institutionalPosition ?? (role === 'STUDENT' ? 'STUDENT' : null),
    isTeachingStaff: role === 'TEACHER',
  }));
}

async function readCompletedVisibleNodes(roadmapId: string, userIds: string[]) {
  const counts = await prisma.completion.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, roadmapNode: { roadmapId, isVisible: true } },
    _count: { _all: true },
  });
  return new Map(counts.map(({ userId, _count }) => [userId, _count._all]));
}

export async function readCourseParticipants(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
): Promise<CourseParticipants> {
  const courseOffering = await roadmapRead(
    { userId: actor.id, identifier },
    'oversee',
    async ({ courseOffering }) => courseOffering,
    { roadmap: 'optional' },
  );
  const [institutionalRoster, visibleNodes] = await Promise.all([
    readInstitutionalRoster(actor, identifier),
    courseOffering.roadmap
      ? prisma.roadmapNode.count({
          where: { roadmapId: courseOffering.roadmap.id, isVisible: true },
        })
      : 0,
  ]);
  const roster = institutionalRoster ?? (await readLocalRoster(courseOffering.id));
  const learnerIds = roster.flatMap(({ userId, isTeachingStaff }) =>
    userId && !isTeachingStaff ? [userId] : [],
  );
  const completed = courseOffering.roadmap
    ? await readCompletedVisibleNodes(courseOffering.roadmap.id, learnerIds)
    : new Map<string, number>();

  const members = roster
    .map(({ key, name, userId, sections, institutionalPosition, isTeachingStaff }) => {
      const completedNodes =
        courseOffering.roadmap && !isTeachingStaff
          ? ((userId ? completed.get(userId) : undefined) ?? 0)
          : null;
      return {
        isTeachingStaff,
        member: {
          key,
          name,
          sections,
          institutionalPosition,
          hasEntered: userId !== null,
          completedNodes,
          completion:
            completedNodes === null ? null : completionRatio(completedNodes, visibleNodes),
        },
      };
    })
    .sort((a, b) => compareCourseMembers(a.member, b.member));
  const students = members.flatMap(({ isTeachingStaff, member }) =>
    isTeachingStaff ? [] : [member],
  );

  return {
    course: { ...identifier, name: courseOffering.course.name },
    source: institutionalRoster ? 'MUFASA' : 'LOCAL',
    hasRoadmap: Boolean(courseOffering.roadmap),
    visibleNodes,
    studentCount: students.filter((member) => member.institutionalPosition === 'STUDENT').length,
    averageStudentCompletion: averageStudentCompletion(students),
    teachingStaff: members.flatMap(({ isTeachingStaff, member }) =>
      isTeachingStaff ? [member] : [],
    ),
    students,
  };
}
