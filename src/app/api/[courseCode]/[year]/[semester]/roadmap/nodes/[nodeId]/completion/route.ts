import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { completeNode } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ identifier, user, params }) => {
  const completion = await completeNode(
    { userId: user.id, identifier, nodeId: params.nodeId },
    roadmapChangePort,
  );
  return NextResponse.json({
    completion: {
      id: completion.id,
      roadmapNodeId: completion.roadmapNodeId,
      completedAt: completion.completedAt,
    },
  });
});
