import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapNode, getRoadmapNodesForActor } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
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
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const nodes = await getRoadmapNodesForActor(actor, identifier).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ nodes });
  });
}
