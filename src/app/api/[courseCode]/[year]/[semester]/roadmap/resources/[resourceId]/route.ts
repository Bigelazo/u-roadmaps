import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { requireAuthenticatedUser } from '@/shared/server/session';
import { removeRoadmapResource, updateRoadmapResource } from '@/features/roadmap/server';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; resourceId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
    const resource = await updateRoadmapResource({
      userId: user.id,
      identifier,
      id: params.resourceId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ resource });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    await removeRoadmapResource({ userId: user.id, identifier, id: params.resourceId }).match(
      (value) => value,
      throwApiError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
