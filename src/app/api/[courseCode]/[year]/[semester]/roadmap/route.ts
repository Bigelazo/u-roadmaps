import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapForActor, readRoadmapForParticipant } from '@/features/roadmap/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser();
    return NextResponse.json(
      await readRoadmapForParticipant({ userId: user.id, identifier }).match(
        (value) => value,
        throwApplicationError,
      ),
    );
  });
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const actor = await requireAuthenticatedUser();
    const roadmap = await createRoadmapForActor(actor, identifier, () => parseJson(request)).match(
      (value) => value,
      throwApplicationError,
    );
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...identifier }, { status: 201 });
  });
}
