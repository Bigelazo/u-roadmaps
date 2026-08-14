import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  createRoadmap,
  getRoadmapDto,
  parseCourseOfferingIdentifier,
  parseJson,
} from '@/lib/roadmap-api';
import { requireCourseOfferingParticipation, requireRoadmapCreationAccess } from '@/lib/auth';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]);
    return NextResponse.json(await getRoadmapDto(identifier, participation.role === 'TEACHER'));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    await requireRoadmapCreationAccess(identifier);
    const roadmap = await createRoadmap(identifier, await parseJson(request));
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...identifier }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
