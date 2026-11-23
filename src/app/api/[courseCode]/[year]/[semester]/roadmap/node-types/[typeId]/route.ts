import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { deleteRoadmapNodeType, updateRoadmapNodeType } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ actor, params, body }) => {
    const result = await updateRoadmapNodeType(
      { ...actor, id: params.typeId, input: body },
      roadmapChangePort,
    );
    return NextResponse.json({ nodeType: result.nodeType });
  },
  { body: true },
);

export const DELETE = courseRoute(async ({ actor, params }) => {
  await deleteRoadmapNodeType({ ...actor, id: params.typeId }, roadmapChangePort);
  return new NextResponse(null, { status: 204 });
});
