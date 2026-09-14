import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { deleteRoadmapNodeType, updateRoadmapNodeType } from '@/features/roadmap/server';

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/node-types/[typeId]'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([parseJson(request), requireAuthenticatedUser()]);
    const nodeType = await updateRoadmapNodeType({
      userId: user.id,
      identifier,
      id: params.typeId,
      input: body,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json({ nodeType });
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/node-types/[typeId]'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    await deleteRoadmapNodeType({ userId: user.id, identifier, id: params.typeId }).match(
      (value) => value,
      throwApplicationError,
    );
    return new NextResponse(null, { status: 204 });
  });
}
