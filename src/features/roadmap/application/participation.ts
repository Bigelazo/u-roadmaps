import type { RoadmapChangePort } from './change-port';
import { forbidden } from './errors';
import 'server-only';

import { synchronizeCourseOffering, type AcademicUser } from './academic-participation';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { decideRoadmapCreation } from '@/features/roadmap/domain/roadmap-capability';

export type RoadmapActor = AcademicUser;

export async function requireRoadmapCreationAccess(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  const synchronization = await synchronizeCourseOffering(actor, identifier, changePort);
  const decision = decideRoadmapCreation({
    report: synchronization.status === 'complete' ? { position: synchronization.position } : null,
    participation: synchronization.participation,
  });
  if (decision.kind === 'REJECTED')
    throw forbidden('Solo el profesor de cátedra puede crear el roadmap de este curso.');
}
