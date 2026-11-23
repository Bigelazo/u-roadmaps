import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { changeImpactVersion } from '@/app/_adapters/roadmap';
import { deleteRoadmapNode, updateRoadmapNode } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ actor, params, body, request }) => {
    const input = {
      ...actor,
      id: params.nodeId,
      input: body,
      changeImpactVersion: changeImpactVersion(request),
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
    changeImpactVersion: changeImpactVersion(request),
  };
  await deleteRoadmapNode(input, roadmapChangePort);
  return new NextResponse(null, { status: 204 });
});
