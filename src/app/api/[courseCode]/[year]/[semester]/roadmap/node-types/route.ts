import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapNodeType, getNodeTypesForActor } from '@/features/roadmap/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/node-types'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser();
    const nodeTypes = await getNodeTypesForActor(actor, identifier).match(
      (value) => value,
      throwApplicationError,
    );
    return NextResponse.json({ nodeTypes });
  });
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/node-types'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([parseJson(request), requireAuthenticatedUser()]);
    const nodeType = await createRoadmapNodeType({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json({ nodeType }, { status: 201 });
  });
}
