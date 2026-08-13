import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiErrorResponse, parseCoursePath, requireRoadmap, requireUuid } from '@/lib/roadmap-api';
import { requireCourseTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ ramo: string; anio: string; semestre: string; dependencyId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const dependencyId = requireUuid(params.dependencyId, 'dependencyId');
    const dependency = await prisma.dependencia.findFirst({
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
    await prisma.dependencia.delete({ where: { id: dependency.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
