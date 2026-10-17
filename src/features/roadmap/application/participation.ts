import type { RoadmapChangePort } from './change-port';
import { forbidden, roadmapNotFound } from './roadmap-command/errors';
import 'server-only';

import {
  readMufasaCourseAccess,
  materializeParticipation,
  synchronizeParticipation,
  type AcademicUser,
} from './academic-participation';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  decideRoadmapCreation,
  participationGrants,
  type RoadmapCapability,
} from '@/features/roadmap/domain/roadmap-capability';
import { effectivePosition } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import { withApplicationResult } from '@/shared/errors/server';

export { synchronizeParticipation } from './academic-participation';

export type RoadmapActor = AcademicUser;

async function resolveParticipation(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  courseOfferingId: string,
  capability: RoadmapCapability,
  changePort: RoadmapChangePort,
) {
  const participation = await prisma.participation.findFirst({
    where: { userId: actor.id, courseOfferingId, isActive: true },
  });
  if (participationGrants(participation, capability)) return participation;
  const synchronized = await synchronizeParticipation(actor, identifier, changePort);
  return participationGrants(synchronized, capability) ? synchronized : null;
}

/**
 * The Course offering and the actor's Participation in it. The offering may have no
 * Roadmap yet, so callers that need one refuse its absence themselves.
 */
export const requireCourseOfferingParticipation = withApplicationResult(
  async function requireCourseOfferingParticipation(
    actor: RoadmapActor,
    identifier: CourseOfferingIdentifier,
    capability: RoadmapCapability,
    changePort: RoadmapChangePort,
  ) {
    const courseOffering = await prisma.courseOffering.findUnique({
      where: { courseCode_year_semester: identifier },
      include: { roadmap: true },
    });
    if (!courseOffering) throw roadmapNotFound();
    const participation = await resolveParticipation(
      actor,
      identifier,
      courseOffering.id,
      capability,
      changePort,
    );
    if (!participation) throw forbidden();
    return { actor, courseOffering, participation };
  },
);

export const requireRoadmapCreationAccess = withApplicationResult(
  async function requireRoadmapCreationAccess(
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
  },
);
