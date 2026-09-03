import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapForActor, readRoadmapForParticipant } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

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
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const roadmap = await createRoadmapForActor(actor, identifier, () => parseJson(request)).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...identifier }, { status: 201 });
  });
}
