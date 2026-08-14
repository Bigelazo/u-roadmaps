import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  parseCourseOfferingIdentifier,
  requireRoadmap,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseOfferingTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; dependencyId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const dependencyId = requireUuid(params.dependencyId, 'dependencyId');
    const dependency = await prisma.dependency.findFirst({
      where: { id: dependencyId, sourceNode: { roadmapId: roadmap.id } },
    });
    if (!dependency) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPENDENCY_NOT_FOUND',
            message: 'La dependencia no existe en este roadmap.',
          },
        },
        { status: 404 },
      );
    }
    await prisma.dependency.delete({ where: { id: dependency.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
