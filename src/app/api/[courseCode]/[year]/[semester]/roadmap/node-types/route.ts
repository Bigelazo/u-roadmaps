import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  getAvailableTypes,
  parseCourseOfferingIdentifier,
  parseJson,
  requireRoadmap,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapNodeType } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingParticipation(identifier, ['STUDENT', 'TEACHER']);
    const roadmap = await requireRoadmap(identifier);
    return NextResponse.json({ nodeTypes: await getAvailableTypes(roadmap.id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const nodeType = await createRoadmapNodeType({ userId: user.id, identifier, input: body });
    return NextResponse.json({ nodeType }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
