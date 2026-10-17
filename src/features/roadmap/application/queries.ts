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
import { applicationResult, unwrap } from '@/shared/errors/server';

export function createRoadmapForActor(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  readInput: () => Promise<Record<string, unknown>>,
  changePort: RoadmapChangePort,
) {
  return applicationResult(async () => {
    await unwrap(() => requireRoadmapCreationAccess(actor, identifier, changePort));
    const input = await readInput();
    return unwrap(() => createRoadmap(identifier, input, actor, changePort));
  });
}

export function getNodeTypesForActor(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  return applicationResult(async () => {
    const { courseOffering, participation } = await unwrap(() =>
      requireCourseOfferingParticipation(actor, identifier, 'read', changePort),
    );
    const { roadmap } = requireRoadmapCapability({
      capability: 'read',
      participation,
      roadmap: courseOffering.roadmap,
    });
    return getAvailableTypes(roadmap.id);
  });
}
