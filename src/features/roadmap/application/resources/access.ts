import 'server-only';

import type { Prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';
import { requireUuid } from '@/shared/validation';
import { resourceNotFound } from '../errors';
import type { RoadmapChangePort } from '../change-port';
import { roadmapCommand, type RoadmapParticipant } from '../roadmap-command';
import {
  requireCanvasPreviewNodeAccess,
  requireStudentNodeAccess,
} from '@/features/roadmap/application/completion';

async function requireRoadmapResource(
  transaction: Prisma.TransactionClient,
  resourceId: string,
  roadmapId: string,
) {
  const resource = await transaction.resource.findFirst({
    where: { id: resourceId, roadmapNode: { roadmapId } },
    select: { id: true, type: true, fileKey: true, roadmapNodeId: true },
  });
  if (!resource) throw resourceNotFound();
  return resource;
}

const resourceAccess = roadmapCommand({
  capability: 'complete',
  lock: 'key-share',
  parse: (input: { resourceId: string; type: 'FILE' | 'LINK'; fileKey: string | null }) => ({
    ...input,
    resourceId: requireUuid(input.resourceId, 'resourceId'),
  }),
  access: 'none',
  run: async ({ tx, roadmap, actor, input }) => {
    const resource = await requireRoadmapResource(tx, input.resourceId, roadmap.id);
    if (resource.type !== input.type)
      throw new ApplicationError(
        400,
        'INVALID_RESOURCE_TYPE',
        'Los archivos se registran al descargarlos.',
      );
    await requireStudentNodeAccess(tx, {
      userId: actor.userId,
      roadmapId: roadmap.id,
      nodeId: resource.roadmapNodeId,
    });
    const reviewsCurrentMaterial = resource.fileKey === input.fileKey;
    await tx.resourceAccess.upsert({
      where: { userId_resourceId: { userId: actor.userId, resourceId: resource.id } },
      create: {
        userId: actor.userId,
        resourceId: resource.id,
        accessCount: 1,
        isReviewed: reviewsCurrentMaterial,
      },
      update: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
        ...(reviewsCurrentMaterial ? { isReviewed: true } : {}),
      },
    });
    return { result: undefined, facts: [] };
  },
});

type ResourceAccessRequest = RoadmapParticipant & { resourceId: string };

export const recordLinkResourceAccess = (
  request: ResourceAccessRequest,
  changePort: RoadmapChangePort,
) => resourceAccess({ ...request, type: 'LINK', fileKey: null }, changePort);

export const recordFileResourceAccess = (
  request: ResourceAccessRequest & { fileKey: string },
  changePort: RoadmapChangePort,
) => resourceAccess({ ...request, type: 'FILE' }, changePort);

export const recordCanvasPreviewResourceReview = roadmapCommand({
  capability: 'edit',
  lock: 'key-share',
  parse: ({ resourceId }: { resourceId: string }) => requireUuid(resourceId, 'resourceId'),
  access: 'none',
  run: async ({ tx, roadmap, participation, input: resourceId }) => {
    const resource = await requireRoadmapResource(tx, resourceId, roadmap.id);
    await requireCanvasPreviewNodeAccess(tx, {
      participationId: participation.id,
      roadmapId: roadmap.id,
      nodeId: resource.roadmapNodeId,
    });
    await tx.simulatedResourceReview.createMany({
      data: { participationId: participation.id, resourceId: resource.id },
      skipDuplicates: true,
    });
    return { result: undefined, facts: [] };
  },
});
