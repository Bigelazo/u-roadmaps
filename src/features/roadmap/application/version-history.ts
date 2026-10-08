import 'server-only';

import {
  compareEditionsNewestFirst,
  compareRecordedStaff,
  editionLabel,
  isWithinVersionHorizon,
  versionHistoryHorizon,
} from '../domain/version-history';
import type { RoadmapActor } from './participation';
import { prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

async function readRoadmapVersionHistoryUnsafe(actor: RoadmapActor, courseCode: string) {
  const course = await prisma.course.findUnique({
    where: { code: courseCode },
    select: {
      code: true,
      name: true,
      courseOfferings: {
        select: {
          year: true,
          semester: true,
          participants: {
            where: { userId: actor.id },
            select: { role: true, isActive: true },
          },
          roadmap: {
            select: {
              closedAt: true,
              creator: { select: { id: true, name: true } },
              closureTeachingStaff: {
                select: {
                  institutionalPosition: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!course) throw new ApplicationError(404, 'COURSE_NOT_FOUND', 'El ramo solicitado no existe.');
  const horizon = versionHistoryHorizon(
    course.courseOfferings.flatMap(({ year, semester, participants }) =>
      participants.map((participation) => ({ year, semester, ...participation })),
    ),
  );
  if (!horizon)
    throw new ApplicationError(
      403,
      'FORBIDDEN',
      'Solo el equipo docente del ramo puede consultar su historial de versiones.',
    );
  const versions = course.courseOfferings
    .flatMap(({ year, semester, roadmap }) =>
      roadmap?.closedAt && isWithinVersionHorizon({ year, semester }, horizon)
        ? [{ year, semester, closedAt: roadmap.closedAt, roadmap }]
        : [],
    )
    .sort(compareEditionsNewestFirst)
    .map(({ year, semester, closedAt, roadmap }) => ({
      year,
      semester,
      edition: editionLabel({ year, semester }),
      closedAt: closedAt.toISOString(),
      creator: roadmap.creator,
      teachingStaff: roadmap.closureTeachingStaff
        .map(({ user, institutionalPosition }) => ({ ...user, institutionalPosition }))
        .sort(compareRecordedStaff),
      // Copies do not exist yet, so every version starts empty.
      origin: { kind: 'EMPTY' as const },
    }));
  return { course: { code: course.code, name: course.name }, horizon, versions };
}

export type RoadmapVersionHistory = Awaited<ReturnType<typeof readRoadmapVersionHistoryUnsafe>>;

export function readRoadmapVersionHistory(actor: RoadmapActor, courseCode: string) {
  return applicationResult(() => readRoadmapVersionHistoryUnsafe(actor, courseCode));
}
