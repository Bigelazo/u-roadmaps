import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { completeNode } from '@/lib/roadmap-completion';
import { handleApiResult, parseCourseOfferingIdentifier, throwApiError } from '@/lib/roadmap-api';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const completion = await completeNode({
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
