import { NextResponse } from 'next/server';
import { handleApiResult, parseCourseOfferingIdentifier, throwApiError } from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { deleteRoadmapDependency } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; dependencyId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    await deleteRoadmapDependency({
      userId: user.id,
      identifier,
      id: params.dependencyId,
    }).match((value) => value, throwApiError);
    return new NextResponse(null, { status: 204 });
  });
}
