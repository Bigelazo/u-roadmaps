import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  getRoadmapDto,
  parseCourseOfferingIdentifier,
  parseJson,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapNode } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const node = await createRoadmapNode({ userId: user.id, identifier, input: body });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]);
    const dto = await getRoadmapDto(identifier, participation.role === 'TEACHER');
    return NextResponse.json({ nodes: dto.nodes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
