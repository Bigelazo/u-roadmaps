import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseFormData, parseJsonObject } from '@/app/_adapters/http';
import {
  createRoadmapResource,
  getRoadmapNodeResources,
  uploadRoadmapResource,
} from '@/features/roadmap/server';

export const POST = courseRoute(async ({ actor, params, request }) => {
  const target = { ...actor, id: params.nodeId };
  const isUpload = request.headers.get('content-type')?.startsWith('multipart/form-data');
  const resource = await (isUpload
    ? uploadRoadmapResource(
        { ...target, file: (await parseFormData(request)).get('file') },
        roadmapChangePort,
      )
    : createRoadmapResource(
        { ...target, input: await parseJsonObject(request) },
        roadmapChangePort,
      ));
  return NextResponse.json({ resource }, { status: 201 });
});

export const GET = courseRoute(async ({ actor, params }) => {
  const resources = await getRoadmapNodeResources({ ...actor, nodeId: params.nodeId });
  return NextResponse.json({ resources });
});
