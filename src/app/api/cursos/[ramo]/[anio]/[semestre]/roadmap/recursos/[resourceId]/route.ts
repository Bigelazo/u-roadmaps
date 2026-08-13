import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  parseCoursePath,
  parseJson,
  requireResourceInRoadmap,
  requireResourceType,
  requireRoadmap,
  requireString,
  requireUrl,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ ramo: string; anio: string; semestre: string; resourceId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const resourceId = requireUuid(params.resourceId, 'resourceId');
    await requireResourceInRoadmap(resourceId, roadmap.id);
    const body = await parseJson(request);
    const data: { titulo?: string; url?: string; tipo?: 'ARCHIVO' | 'ENLACE' | 'VIDEO' } = {};
    if ('titulo' in body) data.titulo = requireString(body.titulo, 'titulo', 240);
    if ('url' in body) data.url = requireUrl(body.url);
    if ('tipo' in body) data.tipo = requireResourceType(body.tipo);
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Debe indicar al menos un campo para actualizar.',
          },
        },
        { status: 400 },
      );
    }
    const resource = await prisma.recurso.update({ where: { id: resourceId }, data });
    return NextResponse.json({
      recurso: { id: resource.id, titulo: resource.titulo, url: resource.url, tipo: resource.tipo },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const resourceId = requireUuid(params.resourceId, 'resourceId');
    await requireResourceInRoadmap(resourceId, roadmap.id);
    await prisma.recurso.delete({ where: { id: resourceId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
