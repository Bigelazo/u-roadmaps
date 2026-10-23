import 'server-only';

import { resourceDto } from '@/features/roadmap/application/roadmap';
import { requireStudentNodeAccess } from '@/features/roadmap/application/completion';
import {
  roadmapRead,
  type RoadmapParticipant,
  type RoadmapReadContext,
} from '@/features/roadmap/application/roadmap-command';
import { readStoredFile } from '@/features/roadmap/infrastructure/resources/lifecycle';
import { nodeNotFound, resourceNotFound } from '@/features/roadmap/application/errors';
import { requireUuid } from '@/shared/validation';

async function requireStudentResourceAccess(
  { tx, participation, roadmap }: RoadmapReadContext,
  nodeId: string,
) {
  if (participation.role !== 'STUDENT') return;
  await requireStudentNodeAccess(tx, {
    userId: participation.userId,
    roadmapId: roadmap.id,
    nodeId,
  });
}

export async function getRoadmapNodeResources({
  nodeId,
  ...participant
}: RoadmapParticipant & { nodeId: string }) {
  const id = requireUuid(nodeId, 'nodeId');
  return roadmapRead(participant, 'read', async (context) => {
    const node = await context.tx.roadmapNode.findFirst({
      where: { id, roadmapId: context.roadmap.id },
    });
    if (!node) throw nodeNotFound();
    await requireStudentResourceAccess(context, node.id);
    const resources = await context.tx.resource.findMany({
      where: { roadmapNodeId: node.id },
      orderBy: { title: 'asc' },
    });
    return resources.map((resource) => resourceDto(resource, participant.identifier));
  });
}

export async function downloadRoadmapResource({
  resourceId,
  ...participant
}: RoadmapParticipant & { resourceId: string }) {
  const id = requireUuid(resourceId, 'resourceId');
  const resource = await roadmapRead(participant, 'read', async (context) => {
    const found = await context.tx.resource.findFirst({
      where: { id, roadmapNode: { roadmapId: context.roadmap.id } },
    });
    if (!found?.fileKey) throw resourceNotFound();
    await requireStudentResourceAccess(context, found.roadmapNodeId);
    const { fileKey, fileContentType, title } = found;
    return { fileKey, fileContentType, title };
  });
  return {
    bytes: await readStoredFile(resource.fileKey),
    contentType: resource.fileContentType ?? 'application/octet-stream',
    title: resource.title,
  };
}
