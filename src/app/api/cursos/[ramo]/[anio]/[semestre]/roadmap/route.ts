import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  createRoadmap,
  getRoadmapDto,
  parseCoursePath,
  parseJson,
} from '@/lib/roadmap-api';
import { requireCourseParticipation, requireRoadmapCreationAccess } from '@/lib/auth';

type Context = { params: Promise<{ ramo: string; anio: string; semestre: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const path = parseCoursePath(await context.params);
    const { participation } = await requireCourseParticipation(path, ['ESTUDIANTE', 'DOCENTE']);
    return NextResponse.json(await getRoadmapDto(path, participation.funcion === 'DOCENTE'));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const path = parseCoursePath(await context.params);
    await requireRoadmapCreationAccess(path);
    const roadmap = await createRoadmap(path, await parseJson(request));
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...path }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
