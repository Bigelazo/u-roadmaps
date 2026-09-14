import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { deleteRoadmapDependency } from '@/features/roadmap/server';

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/dependencies/[dependencyId]'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    await deleteRoadmapDependency({ userId: user.id, identifier, id: params.dependencyId }).match(
      (value) => value,
      throwApplicationError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
