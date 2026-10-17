import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { removeRoadmapResource, updateRoadmapResource } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ identifier, user, params, body }) => {
    const result = await updateRoadmapResource(
      { userId: user.id, identifier, id: params.resourceId, input: body },
      roadmapChangePort,
    );
    return NextResponse.json({ resource: result.resource });
  },
  { body: true },
);

export const DELETE = courseRoute(async ({ identifier, user, params }) => {
  await removeRoadmapResource(
    { userId: user.id, identifier, id: params.resourceId },
    roadmapChangePort,
  );
  return new NextResponse(null, { status: 204 });
});
