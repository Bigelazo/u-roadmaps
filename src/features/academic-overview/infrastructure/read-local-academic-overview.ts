import 'server-only';

import { positionCapabilities } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import type {
  AcademicOverviewActor,
  AcademicOverviewCourse,
  RoadmapClosureCalendar,
} from '../types';

export async function readLocalAcademicOverview(
  actor: AcademicOverviewActor,
  isPastClosure: RoadmapClosureCalendar,
): Promise<AcademicOverviewCourse[]> {
  const participations = await prisma.participation.findMany({
    where: { userId: actor.id, isActive: true },
    include: { courseOffering: { include: { course: true, roadmap: true } } },
    orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
  });

  return participations.map(({ role, institutionalPosition, courseOffering }) => {
    const pastClosure = isPastClosure(courseOffering);
    return {
      courseCode: courseOffering.course.code,
      name: courseOffering.course.name,
      department: courseOffering.course.department,
      year: courseOffering.year,
      semester: courseOffering.semester,
      section: null,
      role,
      institutionalPosition,
      hasRoadmap: Boolean(courseOffering.roadmap),
      isPastClosure: pastClosure,
      canCreateRoadmap:
        positionCapabilities(institutionalPosition).canCreateRoadmap && !pastClosure,
    };
  });
}
