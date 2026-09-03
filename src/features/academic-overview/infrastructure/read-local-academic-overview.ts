import 'server-only';

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

  return participations.map(({ role, courseOffering }) => ({
    courseCode: courseOffering.course.code,
    name: courseOffering.course.name,
    department: courseOffering.course.department,
    year: courseOffering.year,
    semester: courseOffering.semester,
    section: null,
    role,
    institutionalPosition: null,
    hasRoadmap: Boolean(courseOffering.roadmap),
    // Sin respuesta de U-Campus, la participación docente vigente sostiene el
    // permiso, igual que en la ruta de creación.
    canCreateRoadmap: role === 'TEACHER',
  }));
}
