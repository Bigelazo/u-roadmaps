import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { completeSimulatedNode } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ actor, params }) => {
  const completion = await completeSimulatedNode(
    { ...actor, nodeId: params.nodeId },
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
