import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { deleteRoadmapNode, updateRoadmapNode } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ identifier, user, params, body, request }) => {
    const input = {
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
      previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
    };
    const result = await updateRoadmapNode(input, roadmapChangePort);
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
      previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
    };
    await deleteRoadmapNode(input, roadmapChangePort);
    return new NextResponse(null, { status: 204 });
  },
  { authWithParams: true },
);
