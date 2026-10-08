import 'server-only';

import type { Prisma } from '@/shared/server/db';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { ApplicationError } from '@/shared/errors/server';

export type EditorInput = { userId: string; identifier: CourseOfferingIdentifier };

export async function requireEditorRoadmap(
  transaction: Prisma.TransactionClient,
  input: EditorInput,
) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: input.identifier },
    include: { roadmap: true },
  });
  if (!courseOffering) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  const participation = await transaction.participation.findUnique({
    where: {
      userId_courseOfferingId: { userId: input.userId, courseOfferingId: courseOffering.id },
    },
  });
  if (!participation?.isActive || participation.role !== 'TEACHER') {
    throw new ApplicationError(
      403,
      'FORBIDDEN',
      'No tienes participación vigente para esta operación.',
    );
  }
  if (!courseOffering.roadmap) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  // Recognition takes a parent KEY SHARE lock before touching knowledge rows.
  // Serialize edits here, before baseline capture and Node deletion can invert
  // that order through foreign-key locks.
  await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${courseOffering.roadmap.id}::uuid FOR UPDATE`;
  const roadmap = await transaction.roadmap.findUniqueOrThrow({
    where: { id: courseOffering.roadmap.id },
  });
  if (roadmap.closedAt) {
    throw new ApplicationError(
      409,
      'ROADMAP_CLOSED',
      'Este roadmap está cerrado y es de sólo lectura.',
    );
  }
  return roadmap;
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
