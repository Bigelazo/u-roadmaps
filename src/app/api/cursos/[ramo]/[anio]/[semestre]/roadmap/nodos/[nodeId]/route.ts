import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  getRoadmapDto,
  parseCoursePath,
  parseJson,
  requireBoolean,
  requireFiniteNumber,
  requireNodeInRoadmap,
  requireRoadmap,
  requireString,
  requireTypeInRoadmap,
  requireUuid,
  optionalString,
} from '@/lib/roadmap-api';
import { requireCourseTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ ramo: string; anio: string; semestre: string; nodeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const path = parseCoursePath(params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const body = await parseJson(request);
    const data: {
      titulo?: string;
      descripcion?: string | null;
      tipoNodoId?: string;
      posX?: number;
      posY?: number;
      visible?: boolean;
    } = {};

    if ('titulo' in body) data.titulo = requireString(body.titulo, 'titulo', 240);
    if ('descripcion' in body)
      data.descripcion = optionalString(body.descripcion, 'descripcion') ?? null;
    if ('typeId' in body) {
      data.tipoNodoId = requireUuid(body.typeId, 'typeId');
      await requireTypeInRoadmap(data.tipoNodoId, roadmap.id);
    }
    if ('posX' in body) data.posX = requireFiniteNumber(body.posX, 'posX');
    if ('posY' in body) data.posY = requireFiniteNumber(body.posY, 'posY');
    if ('visible' in body) data.visible = requireBoolean(body.visible, 'visible');
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
    await prisma.nodo.update({ where: { id: nodeId }, data });
    const dto = await getRoadmapDto(path);
    return NextResponse.json({ nodo: dto.nodos.find((node) => node.id === nodeId) });
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
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    await prisma.nodo.delete({ where: { id: nodeId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
