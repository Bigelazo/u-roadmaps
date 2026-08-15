import { NextResponse } from 'next/server';
import {
  getAvailableTypes,
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  requireRoadmap,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapNodeType } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingParticipation(identifier, ['STUDENT', 'TEACHER']).match(
      (value) => value,
      throwApiError,
    );
    const roadmap = await requireRoadmap(identifier).match((value) => value, throwApiError);
    return NextResponse.json({ nodeTypes: await getAvailableTypes(roadmap.id) });
  });
}

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const nodeType = await createRoadmapNodeType({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ nodeType }, { status: 201 });
  });
}
