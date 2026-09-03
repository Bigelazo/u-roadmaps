import 'server-only';

import { prisma } from '@/shared/server/db';
import {
  ApiError,
  apiResult,
  requireUuid,
  resourceDto,
} from '@/features/roadmap/application/roadmap';
import {
  requireCourseOfferingParticipation,
  type RoadmapActor,
} from '@/features/roadmap/application/participation';
import { requireStudentNodeAccess } from '@/features/roadmap/application/completion';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { readUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';

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

async function requireResourceRoadmap(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  const { participation, courseOffering } = await requireCourseOfferingParticipation(
    actor,
    identifier,
    ['STUDENT', 'TEACHER'],
  ).match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
  const roadmap = courseOffering.roadmap;
  if (!roadmap) {
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return { participation, roadmap };
}

type ResourceParticipation = Awaited<ReturnType<typeof requireResourceRoadmap>>['participation'];

async function requireStudentResourceAccess(
  participation: ResourceParticipation,
  roadmapId: string,
  node: { id: string; isVisible: boolean },
) {
  if (participation.role === 'STUDENT' && !node.isVisible) {
    throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
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

async function getRoadmapNodeResourcesUnsafe({ actor, identifier, nodeId }: NodeResourcesInput) {
  const { participation, roadmap } = await requireResourceRoadmap(actor, identifier);
  const parsedNodeId = requireUuid(nodeId, 'nodeId');
  const node = await prisma.roadmapNode.findFirst({
    where: { id: parsedNodeId, roadmapId: roadmap.id },
  });
  if (!node) throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  await requireStudentResourceAccess(participation, roadmap.id, node);
  const resources = await prisma.resource.findMany({
    where: { roadmapNodeId: parsedNodeId },
    orderBy: { title: 'asc' },
  });
  return resources.map((resource) => resourceDto(resource, identifier));
}

async function downloadRoadmapResourceUnsafe({
  actor,
  identifier,
  resourceId,
}: ResourceDownloadInput) {
  const { participation, roadmap } = await requireResourceRoadmap(actor, identifier);
  const resource = await prisma.resource.findFirst({
    where: {
      id: requireUuid(resourceId, 'resourceId'),
      roadmapNode: { roadmapId: roadmap.id },
    },
    include: { roadmapNode: { select: { isVisible: true } } },
  });
  if (!resource || !resource.fileKey) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
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
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El archivo ya no está disponible.');
  }
}

export function getRoadmapNodeResources(input: NodeResourcesInput) {
  return apiResult(() => getRoadmapNodeResourcesUnsafe(input));
}

export function downloadRoadmapResource(input: ResourceDownloadInput) {
  return apiResult(() => downloadRoadmapResourceUnsafe(input));
}
