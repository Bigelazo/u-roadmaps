import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { completeSimulatedNode } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const completion = await completeSimulatedNode({
      userId: user.id,
      identifier,
      nodeId: params.nodeId,
    }).match((value) => value, throwApiError);
    return NextResponse.json({
      completion: {
        id: completion.id,
        roadmapNodeId: completion.roadmapNodeId,
        completedAt: completion.completedAt,
      },
    });
  });
}
