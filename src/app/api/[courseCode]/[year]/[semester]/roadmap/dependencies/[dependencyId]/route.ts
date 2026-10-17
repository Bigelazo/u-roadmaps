import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { deleteRoadmapDependency } from '@/features/roadmap/server';

export const DELETE = courseRoute(async ({ identifier, user, params }) => {
  await deleteRoadmapDependency(
    { userId: user.id, identifier, id: params.dependencyId },
    roadmapChangePort,
  );
  return new NextResponse(null, { status: 204 });
});
