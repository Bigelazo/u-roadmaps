import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  ApiError,
  findCycle,
  parseCourseOfferingIdentifier,
  parseJson,
  requireNodeInRoadmap,
  requireRoadmap,
  requireUuid,
  handlePrismaError,
} from '@/lib/roadmap-api';
import { requireCourseOfferingTeacher } from '@/lib/auth';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const body = await parseJson(request);
    const sourceNodeId = requireUuid(body.sourceNodeId, 'sourceNodeId');
    const targetNodeId = requireUuid(body.targetNodeId, 'targetNodeId');
    if (sourceNodeId === targetNodeId) {
      throw new ApiError(409, 'SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
    }
    await requireNodeInRoadmap(sourceNodeId, roadmap.id);
    await requireNodeInRoadmap(targetNodeId, roadmap.id);
    const dependency = await prisma.$transaction(
      async (transaction) => {
        const dependencies = await transaction.dependency.findMany({
          where: { sourceNode: { roadmapId: roadmap.id } },
          select: { sourceNodeId: true, targetNodeId: true },
        });
        if (
          dependencies.some(
            (dependency) =>
              dependency.sourceNodeId === sourceNodeId && dependency.targetNodeId === targetNodeId,
          )
        ) {
          throw new ApiError(409, 'DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
        }
        if (findCycle(dependencies, sourceNodeId, targetNodeId)) {
          throw new ApiError(409, 'DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
        }
        return transaction.dependency.create({ data: { sourceNodeId, targetNodeId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json(
      { dependency: { id: dependency.id, sourceNodeId, targetNodeId } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return apiErrorResponse(
        new ApiError(
          409,
          'DEPENDENCY_CONFLICT',
          'La dependencia entra en conflicto con otra modificación.',
        ),
      );
    }
    try {
      handlePrismaError(error);
    } catch (caughtError) {
      return apiErrorResponse(caughtError);
    }
    return apiErrorResponse(error);
  }
}
