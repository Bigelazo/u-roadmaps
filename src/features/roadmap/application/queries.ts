import type { RoadmapChangePort } from './change-port';
import { roadmapRead, type RoadmapParticipant } from './roadmap-command';
import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { createRoadmap, getAvailableTypes } from '@/features/roadmap/application/roadmap';
import {
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

export function getNodeTypesForActor(participant: RoadmapParticipant) {
  return roadmapRead(participant, 'read', ({ tx, roadmap }) => getAvailableTypes(roadmap.id, tx));
}
