import { NextResponse } from 'next/server';
import {
  ApiError,
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapNode, previewNodeVisibility, updateRoadmapNode } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

function requireHidePreview(request: Request) {
  if (new URL(request.url).searchParams.get('operation') !== 'HIDE') {
    throw new ApiError(400, 'INVALID_REQUEST', 'operation debe ser HIDE.');
  }
}

export async function GET(request: Request, context: Context) {
  return handleApiResult(async () => {
    requireHidePreview(request);
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    return NextResponse.json(
      await previewNodeVisibility({ userId: user.id, identifier, id: params.nodeId }).match(
        (value) => value,
        throwApiError,
      ),
    );
  });
}

export async function PATCH(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
    const result = await updateRoadmapNode({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json(result);
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    await deleteRoadmapNode({ userId: user.id, identifier, id: params.nodeId }).match(
      (value) => value,
      throwApiError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
