import { NextResponse } from 'next/server';
import {
  createRoadmap,
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireRoadmapCreationAccess } from '@/lib/auth';
import { readRoadmapForParticipant } from '@/lib/roadmap-completion';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    return NextResponse.json(
      await readRoadmapForParticipant({ userId: user.id, identifier }).match(
        (value) => value,
        throwApiError,
      ),
    );
  });
}

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    await requireRoadmapCreationAccess(identifier).match((value) => value, throwApiError);
    const roadmap = await createRoadmap(identifier, await parseJson(request)).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...identifier }, { status: 201 });
  });
}
