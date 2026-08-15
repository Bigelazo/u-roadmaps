import { NextResponse } from 'next/server';
import {
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapNodeType, updateRoadmapNodeType } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; typeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const nodeType = await updateRoadmapNodeType({
      userId: user.id,
      identifier,
      id: params.typeId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ nodeType });
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    await deleteRoadmapNodeType({ userId: user.id, identifier, id: params.typeId }).match(
      (value) => value,
      throwApiError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
