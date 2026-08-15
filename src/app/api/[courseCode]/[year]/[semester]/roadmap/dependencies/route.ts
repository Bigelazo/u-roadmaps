import { NextResponse } from 'next/server';
import { apiErrorResponse, parseCourseOfferingIdentifier, parseJson } from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createRoadmapDependency } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const dependency = await createRoadmapDependency({ userId: user.id, identifier, input: body });
    return NextResponse.json({ dependency }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
