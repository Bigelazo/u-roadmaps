import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { completeNode } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ actor, params }) => {
  const completion = await completeNode({ ...actor, nodeId: params.nodeId }, roadmapChangePort);
  return NextResponse.json({
    completion: {
      id: completion.id,
      roadmapNodeId: completion.roadmapNodeId,
      completedAt: completion.completedAt,
    },
  });
});
