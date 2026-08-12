import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  createRoadmap,
  getRoadmapDto,
  parseCoursePath,
  parseJson,
} from '@/lib/roadmap-api';

type Context = { params: { ramo: string; anio: string; semestre: string } };

export async function GET(_request: Request, context: Context) {
  try {
    return NextResponse.json(await getRoadmapDto(parseCoursePath(context.params)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const path = parseCoursePath(context.params);
    const roadmap = await createRoadmap(path, await parseJson(request));
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...path }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
