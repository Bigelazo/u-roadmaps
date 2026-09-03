import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapNodeType, getNodeTypesForActor } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const nodeTypes = await getNodeTypesForActor(actor, identifier).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ nodeTypes });
  });
}

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
    const nodeType = await createRoadmapNodeType({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ nodeType }, { status: 201 });
  });
}
