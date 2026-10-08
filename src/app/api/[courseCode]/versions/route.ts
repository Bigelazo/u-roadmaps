import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { readRoadmapVersionHistory } from '@/features/roadmap/server';

export async function GET(_request: Request, context: RouteContext<'/api/[courseCode]/versions'>) {
  return handleApplicationResult(async () => {
    const { courseCode } = await context.params;
    const actor = await requireAuthenticatedUser();
    return NextResponse.json(
      await readRoadmapVersionHistory(actor, courseCode).match(
        (value) => value,
        throwApplicationError,
      ),
    );
  });
}
