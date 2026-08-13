import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  getRoadmapDto,
  parseCoursePath,
  parseJson,
  requireBoolean,
  requireFiniteNumber,
  requireRoadmap,
  requireString,
  requireTypeInRoadmap,
  nodeDto,
  optionalString,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseParticipation, requireCourseTeacher } from '@/lib/auth';

type Context = { params: Promise<{ ramo: string; anio: string; semestre: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const path = parseCoursePath(await context.params);
    await requireCourseTeacher(path);
    const roadmap = await requireRoadmap(path);
    const body = await parseJson(request);
    const titulo = requireString(body.titulo, 'titulo', 240);
    const descripcion = optionalString(body.descripcion, 'descripcion');
    const typeId = requireUuid(body.typeId, 'typeId');
    const posX = requireFiniteNumber(body.posX, 'posX');
    const posY = requireFiniteNumber(body.posY, 'posY');
    const visible = body.visible === undefined ? true : requireBoolean(body.visible, 'visible');
    await requireTypeInRoadmap(typeId, roadmap.id);
    const nodo = await prisma.nodo.create({
      data: { roadmapId: roadmap.id, tipoNodoId: typeId, titulo, descripcion, posX, posY, visible },
    });
    return NextResponse.json({ nodo: nodeDto(nodo) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const path = parseCoursePath(await context.params);
    const { participation } = await requireCourseParticipation(path, ['ESTUDIANTE', 'DOCENTE']);
    const dto = await getRoadmapDto(path, participation.funcion === 'DOCENTE');
    return NextResponse.json({ nodos: dto.nodos });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
