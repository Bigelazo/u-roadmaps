import { NextResponse } from 'next/server';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import {
  createRoadmapResource,
  getRoadmapNodeResources,
  uploadRoadmapResource,
} from '@/features/roadmap/server';
import {
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const resource = await uploadRoadmapResource({
        userId: user.id,
        identifier,
        id: params.nodeId,
        file,
      }).match((value) => value, throwApiError);
      return NextResponse.json({ resource }, { status: 201 });
    }
    const body = await parseJson(request);
    const resource = await createRoadmapResource({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ resource }, { status: 201 });
  });
}

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const resources = await getRoadmapNodeResources({
      actor,
      identifier,
      nodeId: params.nodeId,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ resources });
  });
}
