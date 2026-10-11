import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { completeSimulatedNode } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const POST = courseRoute(async ({ identifier, user, params }) => {
  const completion = await unwrap(() =>
    completeSimulatedNode({ userId: user.id, identifier, nodeId: params.nodeId }),
  );
  return NextResponse.json({
    completion: {
      id: completion.id,
      roadmapNodeId: completion.roadmapNodeId,
      completedAt: completion.completedAt,
    },
  });
});
