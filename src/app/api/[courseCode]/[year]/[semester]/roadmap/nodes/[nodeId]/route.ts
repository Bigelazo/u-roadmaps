import { NextResponse } from 'next/server';
import { apiErrorResponse, parseCourseOfferingIdentifier, parseJson } from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapNode, updateRoadmapNode } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser();
    const node = await updateRoadmapNode({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    });
    return NextResponse.json({ node });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    await deleteRoadmapNode({ userId: user.id, identifier, id: params.nodeId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
