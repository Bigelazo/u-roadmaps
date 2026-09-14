import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import {
  createRoadmapResource,
  getRoadmapNodeResources,
  uploadRoadmapResource,
} from '@/features/roadmap/server';

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/resources'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser();
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const resource = await uploadRoadmapResource({
        userId: user.id,
        identifier,
        id: params.nodeId,
        file,
      }).match((value) => value, throwApplicationError);
      return NextResponse.json({ resource }, { status: 201 });
    }
    const body = await parseJson(request);
    const resource = await createRoadmapResource({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json({ resource }, { status: 201 });
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/resources'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser();
    const resources = await getRoadmapNodeResources({
      actor,
      identifier,
      nodeId: params.nodeId,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json({ resources });
  });
}
