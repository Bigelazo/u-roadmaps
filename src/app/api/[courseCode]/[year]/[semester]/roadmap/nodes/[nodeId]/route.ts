import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { ApplicationError } from '@/shared/errors/server';
import {
  deleteRoadmapNode,
  previewNodeDeletion,
  previewNodeVisibility,
  updateRoadmapNode,
} from '@/features/roadmap/server';

function previewOperation(request: Request) {
  const operation = new URL(request.url).searchParams.get('operation');
  if (operation === 'HIDE' || operation === 'DELETE') return operation;
  throw new ApplicationError(400, 'INVALID_REQUEST', 'operation debe ser HIDE o DELETE.');
}

export const GET = courseRoute(
  async ({ identifier, user, params, prepared: operation }) => {
    const input = { userId: user.id, identifier, id: params.nodeId };
    const preview =
      operation === 'HIDE' ? await previewNodeVisibility(input) : await previewNodeDeletion(input);
    return NextResponse.json(preview);
  },
  { prepare: previewOperation, authWithParams: true },
);

export const PATCH = courseRoute(
  async ({ identifier, user, params, body }) => {
    const result = await updateRoadmapNode(
      { userId: user.id, identifier, id: params.nodeId, input: body },
      roadmapChangePort,
    );
    return NextResponse.json(result);
  },
  { body: true, authWithParams: true },
);

export const DELETE = courseRoute(
  async ({ identifier, user, params, request }) => {
    const input = {
      userId: user.id,
      identifier,
      id: params.nodeId,
      previewVersion: request.headers.get('x-node-delete-preview') ?? undefined,
    };
    await deleteRoadmapNode(input, roadmapChangePort);
    return new NextResponse(null, { status: 204 });
  },
  { authWithParams: true },
);
