import type { RoadmapChangePort } from './change-port';
import { forbidden } from './roadmap-command/errors';
import 'server-only';

import {
  readMufasaCourseAccess,
  materializeParticipation,
  type AcademicUser,
} from './academic-participation';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { decideRoadmapCreation } from '@/features/roadmap/domain/roadmap-capability';
import { effectivePosition } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';

export { synchronizeParticipation } from './academic-participation';

export type RoadmapActor = AcademicUser;

export async function requireRoadmapCreationAccess(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  const [{ access, isComplete }, courseOffering] = await Promise.all([
    readMufasaCourseAccess(actor, identifier),
    prisma.courseOffering.findUnique({ where: { courseCode_year_semester: identifier } }),
  ]);
  if (access) await materializeParticipation(actor, identifier, access, changePort);
  // The stored position counts only while U-Campus cannot report completely.
  const participation =
    !isComplete && courseOffering
      ? await prisma.participation.findUnique({
          where: {
            userId_courseOfferingId: { userId: actor.id, courseOfferingId: courseOffering.id },
          },
        })
      : null;
  const decision = decideRoadmapCreation({
    report: isComplete ? { position: access && effectivePosition(access.positions) } : null,
    participation,
  });
  if (decision.kind === 'REJECTED')
    throw forbidden('Solo el profesor de cátedra puede crear el roadmap de este curso.');
  return { actor, courseOffering };
}
