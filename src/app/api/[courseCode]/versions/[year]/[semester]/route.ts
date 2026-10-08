import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { readRoadmapVersion } from '@/features/roadmap/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/versions/[year]/[semester]'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const actor = await requireAuthenticatedUser();
    return NextResponse.json(
      await readRoadmapVersion(actor, identifier).match((value) => value, throwApplicationError),
    );
  });
}
