import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { removeRoadmapResource, updateRoadmapResource } from '@/features/roadmap/server';
import { deliverResourceChange } from '@/features/notifications/server';

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const [body, user] = await Promise.all([parseJson(request), requireAuthenticatedUser()]);
    const result = await updateRoadmapResource({
      userId: user.id,
      identifier,
      id: params.resourceId,
      input: body,
    }).match((value) => value, throwApplicationError);
    if (result.notification) {
      await deliverResourceChange({
        userId: user.id,
        identifier,
        ...result.notification,
        changeKind: 'resource-updated',
      });
    }
    return NextResponse.json({ resource: result.resource });
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    const deleted = await removeRoadmapResource({
      userId: user.id,
      identifier,
      id: params.resourceId,
    }).match((value) => value, throwApplicationError);
    await deliverResourceChange({
      userId: user.id,
      identifier,
      ...deleted,
      changeKind: 'resource-removed',
    });
    return new NextResponse(null, { status: 204 });
  });
}
