import { NextResponse } from 'next/server';
import { apiErrorResponse, parseCourseOfferingIdentifier, parseJson } from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapNodeType, updateRoadmapNodeType } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; typeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const nodeType = await updateRoadmapNodeType({
      userId: user.id,
      identifier,
      id: params.typeId,
      input: body,
    });
    return NextResponse.json({ nodeType });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    await deleteRoadmapNodeType({ userId: user.id, identifier, id: params.typeId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
