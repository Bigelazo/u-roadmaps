import 'server-only';

import type { Prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';
import { requireRoadmapCapability, roadmapNotFound } from './roadmap-command/errors';

export type EditorInput = { userId: string; identifier: CourseOfferingIdentifier };

export async function requireEditorRoadmap(
  transaction: Prisma.TransactionClient,
  input: EditorInput,
) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: input.identifier },
    include: { roadmap: true },
  });
  if (!courseOffering) throw roadmapNotFound();
  const participation = await transaction.participation.findUnique({
    where: {
      userId_courseOfferingId: { userId: input.userId, courseOfferingId: courseOffering.id },
    },
  });
  const { roadmap } = requireRoadmapCapability({
    capability: 'edit',
    participation,
    roadmap: courseOffering.roadmap,
  });
  // Recognition takes a parent KEY SHARE lock before touching knowledge rows.
  // Serialize edits here, before baseline capture and Node deletion can invert
  // that order through foreign-key locks.
  await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmap.id}::uuid FOR UPDATE`;
  // Decide again under the lock: the Roadmap may have closed since it was read.
  return requireRoadmapCapability({
    capability: 'edit',
    participation,
    roadmap: await transaction.roadmap.findUniqueOrThrow({ where: { id: roadmap.id } }),
  }).roadmap;
}

export async function requireNode(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const node = await transaction.roadmapNode.findFirst({ where: { id, roadmapId } });
  if (!node)
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  return node;
}

export async function requireResource(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const resource = await transaction.resource.findFirst({
    where: { id, roadmapNode: { roadmapId } },
  });
  if (!resource)
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  return resource;
}
