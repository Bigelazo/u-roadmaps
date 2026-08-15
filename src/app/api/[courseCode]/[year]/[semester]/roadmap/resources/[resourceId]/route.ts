import { NextResponse } from 'next/server';
import { apiErrorResponse, parseCourseOfferingIdentifier, parseJson } from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapResource, updateRoadmapResource } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; resourceId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const resource = await updateRoadmapResource({
      userId: user.id,
      identifier,
      id: params.resourceId,
      input: body,
    });
    return NextResponse.json({ resource });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    await deleteRoadmapResource({ userId: user.id, identifier, id: params.resourceId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
