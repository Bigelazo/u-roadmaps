import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { completeNode } from '@/lib/roadmap-completion';
import { apiErrorResponse, parseCourseOfferingIdentifier } from '@/lib/roadmap-api';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    const completion = await completeNode({
      userId: user.id,
      identifier,
      nodeId: params.nodeId,
    });
    return NextResponse.json({
      completion: {
        id: completion.id,
        roadmapNodeId: completion.roadmapNodeId,
        completedAt: completion.completedAt,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
