import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { deleteRoadmapNode, updateRoadmapNode } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ actor, params, body, request }) => {
    const input = {
      ...actor,
      id: params.nodeId,
      input: body,
      previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
    };
    const result = await updateRoadmapNode(input, roadmapChangePort);
    return NextResponse.json(result);
  },
  { body: true },
);

export const DELETE = courseRoute(async ({ actor, params, request }) => {
  const input = {
    ...actor,
    id: params.nodeId,
    previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
  };
  await deleteRoadmapNode(input, roadmapChangePort);
  return new NextResponse(null, { status: 204 });
});
