import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { completeNode } from '@/features/roadmap/server';

export async function POST(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/completion'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    const completion = await completeNode({
      userId: user.id,
      identifier,
      nodeId: params.nodeId,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json({
      completion: {
        id: completion.id,
        roadmapNodeId: completion.roadmapNodeId,
        completedAt: completion.completedAt,
      },
    });
  });
}
