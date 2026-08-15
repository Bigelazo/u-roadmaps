import { NextResponse } from 'next/server';
import { requireCourseOfferingParticipation } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  ApiError,
  apiErrorResponse,
  parseCourseOfferingIdentifier,
  requireNodeInRoadmap,
} from '@/lib/roadmap-api';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const { user, courseOffering } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
    ]);
    const roadmap = courseOffering.roadmap;
    if (!roadmap)
      throw new ApiError(
        404,
        'ROADMAP_NOT_FOUND',
        'El profesor todavía no ha creado un roadmap para este curso.',
      );
    const node = await requireNodeInRoadmap(params.nodeId, roadmap.id);
    if (!node.isVisible)
      throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
    const prerequisites = await prisma.dependency.findMany({
      where: { targetNodeId: node.id, sourceNode: { isVisible: true } },
      select: { sourceNodeId: true },
    });
    const completed = await prisma.completion.findMany({
      where: {
        userId: user.id,
        roadmapNodeId: { in: prerequisites.map((item) => item.sourceNodeId) },
      },
      select: { roadmapNodeId: true },
    });
    if (completed.length !== prerequisites.length) {
      throw new ApiError(
        409,
        'PREREQUISITES_PENDING',
        'Debes completar los prerrequisitos visibles antes de este nodo.',
      );
    }
    const completion = await prisma.completion.create({
      data: { userId: user.id, roadmapNodeId: node.id },
    });
    return NextResponse.json(
      {
        completion: {
          id: completion.id,
          roadmapNodeId: completion.roadmapNodeId,
          completedAt: completion.completedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
