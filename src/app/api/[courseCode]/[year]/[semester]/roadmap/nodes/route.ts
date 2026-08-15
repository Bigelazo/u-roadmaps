import { NextResponse } from 'next/server';
import {
  getRoadmapDto,
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapNode } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const node = await createRoadmapNode({ userId: user.id, identifier, input: body }).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ node }, { status: 201 });
  });
}

export async function GET(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]).match((value) => value, throwApiError);
    const dto = await getRoadmapDto(identifier, participation.role === 'TEACHER').match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ nodes: dto.nodes });
  });
}
