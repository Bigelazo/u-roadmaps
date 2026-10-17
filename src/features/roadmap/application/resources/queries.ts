import type { RoadmapChangePort } from '../change-port';
import 'server-only';

import { prisma } from '@/shared/server/db';
import { resourceDto } from '@/features/roadmap/application/roadmap';
import {
  requireCourseOfferingParticipation,
  type RoadmapActor,
} from '@/features/roadmap/application/participation';
import { requireStudentNodeAccess } from '@/features/roadmap/application/completion';
import { requireRoadmapCapability } from '@/features/roadmap/application/roadmap-command/errors';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { readUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';
import { requireUuid } from '@/shared/validation';
import { ApplicationError } from '@/shared/errors/server';

type NodeResourcesInput = {
  actor: RoadmapActor;
  identifier: CourseOfferingIdentifier;
  nodeId: string;
};

type ResourceDownloadInput = {
  actor: RoadmapActor;
  identifier: CourseOfferingIdentifier;
  resourceId: string;
};

async function requireResourceRoadmap(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  changePort: RoadmapChangePort,
) {
  const { participation, courseOffering } = await requireCourseOfferingParticipation(
    actor,
    identifier,
    'read',
    changePort,
  );
  return requireRoadmapCapability({
    capability: 'read',
    participation,
    roadmap: courseOffering.roadmap,
  });
}

type ResourceParticipation = Awaited<ReturnType<typeof requireResourceRoadmap>>['participation'];

async function requireStudentResourceAccess(
  participation: ResourceParticipation,
  roadmapId: string,
  node: { id: string; isVisible: boolean },
) {
  if (participation.role === 'STUDENT' && !node.isVisible) {
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  }
  if (participation.role === 'STUDENT') {
    await prisma.$transaction((transaction) =>
      requireStudentNodeAccess(transaction, {
        userId: participation.userId,
        roadmapId,
        nodeId: node.id,
      }),
    );
  }
}

export async function getRoadmapNodeResources(
  { actor, identifier, nodeId }: NodeResourcesInput,
  changePort: RoadmapChangePort,
) {
  const { participation, roadmap } = await requireResourceRoadmap(actor, identifier, changePort);
  const parsedNodeId = requireUuid(nodeId, 'nodeId');
  const node = await prisma.roadmapNode.findFirst({
    where: { id: parsedNodeId, roadmapId: roadmap.id },
  });
  if (!node)
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  await requireStudentResourceAccess(participation, roadmap.id, node);
  const resources = await prisma.resource.findMany({
    where: { roadmapNodeId: parsedNodeId },
    orderBy: { title: 'asc' },
  });
  return resources.map((resource) => resourceDto(resource, identifier));
}

export async function downloadRoadmapResource(
  { actor, identifier, resourceId }: ResourceDownloadInput,
  changePort: RoadmapChangePort,
) {
  const { participation, roadmap } = await requireResourceRoadmap(actor, identifier, changePort);
  const resource = await prisma.resource.findFirst({
    where: {
      id: requireUuid(resourceId, 'resourceId'),
      roadmapNode: { roadmapId: roadmap.id },
    },
    include: { roadmapNode: { select: { isVisible: true } } },
  });
  if (!resource || !resource.fileKey) {
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  }
  await requireStudentResourceAccess(participation, roadmap.id, {
    id: resource.roadmapNodeId,
    isVisible: resource.roadmapNode.isVisible,
  });
  try {
    return {
      bytes: await readUploadedFile(resource.fileKey),
      contentType: resource.fileContentType ?? 'application/octet-stream',
      title: resource.title,
    };
  } catch {
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El archivo ya no está disponible.');
  }
}
