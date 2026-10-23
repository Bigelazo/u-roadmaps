import 'server-only';

import { positionCapabilities } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import type {
  AcademicOverviewActor,
  AcademicOverviewCourse,
  RoadmapClosureCalendar,
} from '../types';

async function readCompletedVisibleNodes(userId: string, roadmapIds: string[]) {
  if (roadmapIds.length === 0) return new Map<string, number>();
  const completions = await prisma.completion.findMany({
    where: { userId, roadmapNode: { roadmapId: { in: roadmapIds }, isVisible: true } },
    select: { roadmapNode: { select: { roadmapId: true } } },
  });
  const counts = new Map<string, number>();
  for (const { roadmapNode } of completions) {
    counts.set(roadmapNode.roadmapId, (counts.get(roadmapNode.roadmapId) ?? 0) + 1);
  }
  return counts;
}

export async function readLocalAcademicOverview(
  actor: AcademicOverviewActor,
  isPastClosure: RoadmapClosureCalendar,
): Promise<AcademicOverviewCourse[]> {
  const participations = await prisma.participation.findMany({
    where: { userId: actor.id, isActive: true },
    include: {
      courseOffering: {
        include: {
          course: true,
          roadmap: {
            select: {
              id: true,
              _count: { select: { roadmapNodes: { where: { isVisible: true } } } },
            },
          },
        },
      },
    },
    orderBy: [{ courseOffering: { year: 'desc' } }, { courseOffering: { semester: 'desc' } }],
  });
  const completedNodes = await readCompletedVisibleNodes(
    actor.id,
    participations.flatMap(({ role, courseOffering }) =>
      role === 'STUDENT' && courseOffering.roadmap ? [courseOffering.roadmap.id] : [],
    ),
  );

  return participations.map(({ role, institutionalPosition, courseOffering }) => {
    const pastClosure = isPastClosure(courseOffering);
    const { roadmap } = courseOffering;
    return {
      courseCode: courseOffering.course.code,
      name: courseOffering.course.name,
      department: courseOffering.course.department,
      year: courseOffering.year,
      semester: courseOffering.semester,
      section: null,
      role,
      institutionalPosition,
      hasRoadmap: Boolean(roadmap),
      progress:
        role === 'STUDENT' && roadmap && roadmap._count.roadmapNodes > 0
          ? {
              completedNodes: completedNodes.get(roadmap.id) ?? 0,
              visibleNodes: roadmap._count.roadmapNodes,
            }
          : null,
      isPastClosure: pastClosure,
      canCreateRoadmap:
        positionCapabilities(institutionalPosition).canCreateRoadmap && !pastClosure,
    };
  });
}
