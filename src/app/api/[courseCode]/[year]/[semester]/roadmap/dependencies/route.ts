import { NextResponse } from 'next/server';
import {
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createRoadmapDependency } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const dependency = await createRoadmapDependency({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ dependency }, { status: 201 });
  });
}
