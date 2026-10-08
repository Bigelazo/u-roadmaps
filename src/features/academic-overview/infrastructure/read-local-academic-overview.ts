import 'server-only';

import { positionCapabilities } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import type { AcademicOverviewActor, AcademicOverviewCourse } from '../types';

export async function readLocalAcademicOverview(
  actor: AcademicOverviewActor,
): Promise<AcademicOverviewCourse[]> {
  const participations = await prisma.participation.findMany({
    where: { userId: actor.id, isActive: true },
    include: { courseOffering: { include: { course: true, roadmap: true } } },
    orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
  });

  return participations.map(({ role, institutionalPosition, courseOffering }) => ({
    courseCode: courseOffering.course.code,
    name: courseOffering.course.name,
    department: courseOffering.course.department,
    year: courseOffering.year,
    semester: courseOffering.semester,
    section: null,
    role,
    institutionalPosition,
    hasRoadmap: Boolean(courseOffering.roadmap),
    canCreateRoadmap: positionCapabilities(institutionalPosition).canCreateRoadmap,
  }));
}
