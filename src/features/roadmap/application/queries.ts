import type { RoadmapChangePort } from './change-port';
import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  createRoadmap,
  getAvailableTypes,
  requireRoadmap,
} from '@/features/roadmap/application/roadmap';
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
    const { courseOffering } = await unwrap(() =>
      requireCourseOfferingParticipation(actor, identifier, ['STUDENT', 'TEACHER'], changePort),
    );
    if (!courseOffering.roadmap) {
      const roadmap = await unwrap(() => requireRoadmap(identifier));
      return getAvailableTypes(roadmap.id);
    }
    return getAvailableTypes(courseOffering.roadmap.id);
  });
}
