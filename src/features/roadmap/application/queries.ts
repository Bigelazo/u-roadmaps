import type { RoadmapChangePort } from './change-port';
import { requireRoadmapCapability } from './roadmap-command/errors';
import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { createRoadmap, getAvailableTypes } from '@/features/roadmap/application/roadmap';
import {
  requireCourseOfferingParticipation,
  requireRoadmapCreationAccess,
  type RoadmapActor,
} from '@/features/roadmap/application/participation';

export async function createRoadmapForActor(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  readInput: () => Promise<Record<string, unknown>>,
  changePort: RoadmapChangePort,
) {
  await requireRoadmapCreationAccess(actor, identifier, changePort);
  const input = await readInput();
  return createRoadmap(identifier, input, actor, changePort);
}

export async function getNodeTypesForActor(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  const { courseOffering, participation } = await requireCourseOfferingParticipation(
    actor,
    identifier,
    'read',
    changePort,
  );
  const { roadmap } = requireRoadmapCapability({
    capability: 'read',
    participation,
    roadmap: courseOffering.roadmap,
  });
  return getAvailableTypes(roadmap.id);
}
