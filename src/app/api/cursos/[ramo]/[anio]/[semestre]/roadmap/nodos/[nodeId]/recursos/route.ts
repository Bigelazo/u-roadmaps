import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  ApiError,
  apiErrorResponse,
  parseCoursePath,
  parseJson,
  requireNodeInRoadmap,
  requireResourceType,
  requireRoadmap,
  requireString,
  requireUrl,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseParticipation, requireCourseTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ ramo: string; anio: string; semestre: string; nodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const body = await parseJson(request);
    const titulo = requireString(body.titulo, 'titulo', 240);
    const url = requireUrl(body.url);
    const tipo = requireResourceType(body.tipo);
    const resource = await prisma.recurso.create({ data: { nodoId: nodeId, titulo, url, tipo } });
    return NextResponse.json(
      {
        recurso: {
          id: resource.id,
          titulo: resource.titulo,
          url: resource.url,
          tipo: resource.tipo,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    const { participation } = await requireCourseParticipation(path, ['ESTUDIANTE', 'DOCENTE']);
    const roadmap = await requireRoadmap(path);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    const node = await requireNodeInRoadmap(nodeId, roadmap.id);
    if (participation.funcion === 'ESTUDIANTE' && !node.visible) {
      throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
    }
    const recursos = await prisma.recurso.findMany({
      where: { nodoId: nodeId },
      orderBy: { titulo: 'asc' },
    });
    return NextResponse.json({
      recursos: recursos.map((resource) => ({
        id: resource.id,
        titulo: resource.titulo,
        url: resource.url,
        tipo: resource.tipo,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
