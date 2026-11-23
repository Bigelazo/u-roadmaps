import 'server-only';

import { resourceDto } from '@/features/roadmap/application/roadmap';
import { requireNodeAccess } from '@/features/roadmap/application/completion';
import {
  roadmapRead,
  type RoadmapParticipant,
  type RoadmapReadContext,
} from '@/features/roadmap/application/roadmap-command';
import { openStoredFile } from '@/features/roadmap/infrastructure/resources/lifecycle';
import { nodeNotFound, resourceNotFound } from '@/features/roadmap/application/errors';
import { requireUuid } from '@/shared/validation';
import type { RoadmapChangePort } from '@/features/roadmap/application/change-port';
import { recordFileResourceAccess } from './access';

async function requireStudentResourceAccess(context: RoadmapReadContext, nodeId: string) {
  if (context.participation.role !== 'STUDENT') return;
  await requireNodeAccess(context, 'COMPLETION', nodeId);
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

export async function downloadRoadmapResource(
  { resourceId, ...participant }: RoadmapParticipant & { resourceId: string },
  changePort: RoadmapChangePort,
) {
  const id = requireUuid(resourceId, 'resourceId');
  const resource = await roadmapRead(participant, 'read', async (context) => {
    const found = await context.tx.resource.findFirst({
      where: { id, roadmapNode: { roadmapId: context.roadmap.id } },
    });
    if (!found?.fileKey) throw resourceNotFound();
    await requireStudentResourceAccess(context, found.roadmapNodeId);
    const { fileKey, fileContentType, title } = found;
    const countsAccess = context.participation.role === 'STUDENT' && !context.roadmap.closedAt;
    return { fileKey, fileContentType, title, countsAccess };
  });
  const file = await openStoredFile(resource.fileKey);
  if (resource.countsAccess)
    await recordFileResourceAccess(
      { ...participant, resourceId: id, fileKey: resource.fileKey },
      changePort,
    ).catch((error: unknown) => {
      console.error('Resource access recording failed', { resourceId: id, error });
    });
  return {
    ...file,
    contentType: resource.fileContentType ?? 'application/octet-stream',
    title: resource.title,
  };
}
