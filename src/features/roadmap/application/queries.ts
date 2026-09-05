import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  createRoadmap,
  getAvailableTypes,
  getRoadmapDto,
  requireRoadmap,
} from '@/features/roadmap/application/roadmap';
import {
  requireCourseOfferingParticipation,
  requireRoadmapCreationAccess,
  type RoadmapActor,
} from '@/features/roadmap/application/participation';
import { applicationResult } from '@/shared/errors/server';

type JsonObject = Record<string, unknown>;

export function createRoadmapForActor(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  readInput: () => Promise<JsonObject>,
) {
  return applicationResult(async () => {
    await requireRoadmapCreationAccess(actor, identifier).match(
      (value) => value,
      (error) => {
        throw error;
      },
    );
    return createRoadmap(identifier, await readInput()).match(
      (value) => value,
      (error) => {
        throw error;
      },
    );
  });
}

export function getNodeTypesForActor(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  return applicationResult(async () => {
    const { courseOffering } = await requireCourseOfferingParticipation(actor, identifier, [
      'STUDENT',
      'TEACHER',
    ]).match(
      (value) => value,
      (error) => {
        throw error;
      },
    );
    if (!courseOffering.roadmap) {
      const roadmap = await requireRoadmap(identifier).match(
        (value) => value,
        (error) => {
          throw error;
        },
      );
      return getAvailableTypes(roadmap.id);
    }
    return getAvailableTypes(courseOffering.roadmap.id);
  });
}

export function getRoadmapNodesForActor(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  return applicationResult(async () => {
    const { participation } = await requireCourseOfferingParticipation(actor, identifier, [
      'STUDENT',
      'TEACHER',
    ]).match(
      (value) => value,
      (error) => {
        throw error;
      },
    );
    const roadmap = await getRoadmapDto(identifier, participation.role === 'TEACHER').match(
      (value) => value,
      (error) => {
        throw error;
      },
    );
    return roadmap.nodes;
  });
}
