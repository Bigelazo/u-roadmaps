import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { readSimulatedRoadmap, resetSimulatedCompletions } from '@/features/roadmap/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/simulation'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser();
    return NextResponse.json(
      await readSimulatedRoadmap({ userId: user.id, identifier }).match(
        (value) => value,
        throwApplicationError,
      ),
    );
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/simulation'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser();
    const result = await resetSimulatedCompletions({ userId: user.id, identifier }).match(
      (value) => value,
      throwApplicationError,
    );
    return NextResponse.json({ deletedCount: result.count });
  });
}
