import 'server-only';

import { resourceDto } from '@/features/roadmap/application/roadmap';
import { requireStudentNodeAccess } from '@/features/roadmap/application/completion';
import {
  roadmapRead,
  type RoadmapParticipant,
  type RoadmapReadContext,
} from '@/features/roadmap/application/roadmap-command';
import { readUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';
import { nodeNotFound, resourceNotFound } from '@/features/roadmap/application/errors';
import { requireUuid } from '@/shared/validation';

/** Students reach a Node's Resources only while the Node is visible and accessible to them. */
async function requireStudentResourceAccess(
  { tx, participation, roadmap }: RoadmapReadContext,
  node: { id: string; isVisible: boolean },
) {
  if (participation.role !== 'STUDENT') return;
  if (!node.isVisible) throw nodeNotFound();
  await requireStudentNodeAccess(tx, {
    userId: participation.userId,
    roadmapId: roadmap.id,
    nodeId: node.id,
  });
}

export function getRoadmapNodeResources({
  nodeId,
  ...participant
}: RoadmapParticipant & { nodeId: string }) {
  return roadmapRead(participant, 'read', async (context) => {
    const node = await context.tx.roadmapNode.findFirst({
      where: { id: requireUuid(nodeId, 'nodeId'), roadmapId: context.roadmap.id },
    });
    if (!node) throw nodeNotFound();
    await requireStudentResourceAccess(context, node);
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
  const resource = await roadmapRead(participant, 'read', async (context) => {
    const found = await context.tx.resource.findFirst({
      where: {
        id: requireUuid(resourceId, 'resourceId'),
        roadmapNode: { roadmapId: context.roadmap.id },
      },
      include: { roadmapNode: { select: { isVisible: true } } },
    });
    if (!found?.fileKey) throw resourceNotFound();
    await requireStudentResourceAccess(context, {
      id: found.roadmapNodeId,
      isVisible: found.roadmapNode.isVisible,
    });
    const { fileKey, fileContentType, title } = found;
    return { fileKey, fileContentType, title };
  });
  // The stored bytes are read after the snapshot, outside the transaction.
  try {
    return {
      bytes: await readUploadedFile(resource.fileKey),
      contentType: resource.fileContentType ?? 'application/octet-stream',
      title: resource.title,
    };
  } catch {
    throw resourceNotFound('El archivo ya no está disponible.');
  }
}
