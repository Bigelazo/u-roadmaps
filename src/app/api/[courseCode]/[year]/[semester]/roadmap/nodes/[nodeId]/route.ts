import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { ApplicationError } from '@/shared/errors/types';
import {
  deleteRoadmapNode,
  previewNodeDeletion,
  previewNodeVisibility,
  updateRoadmapNode,
} from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

function previewOperation(request: Request) {
  const operation = new URL(request.url).searchParams.get('operation');
  if (operation === 'HIDE' || operation === 'DELETE') return operation;
  throw new ApplicationError(400, 'INVALID_REQUEST', 'operation debe ser HIDE o DELETE.');
}

async function nodeInput(context: Context) {
  const params = await context.params;
  const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
  return {
    userId: user.id,
    identifier: parseCourseOfferingIdentifier(params),
    id: params.nodeId,
  };
}

async function deletionInput(context: Context, request: Request) {
  return {
    ...(await nodeInput(context)),
    previewVersion: request.headers.get('x-node-delete-preview') ?? undefined,
  };
}

export async function GET(request: Request, context: Context) {
  return handleApiResult(async () => {
    const operation = previewOperation(request);
    const input = await nodeInput(context);
    const result = operation === 'HIDE' ? previewNodeVisibility(input) : previewNodeDeletion(input);
    return NextResponse.json(await result.match((value) => value, throwApiError));
  });
}

export async function PATCH(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
    const result = await updateRoadmapNode({
      userId: user.id,
      identifier: parseCourseOfferingIdentifier(params),
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json(result);
  });
}

export async function DELETE(request: Request, context: Context) {
  return handleApiResult(async () => {
    await deleteRoadmapNode(await deletionInput(context, request)).match(
      (value) => value,
      throwApiError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
