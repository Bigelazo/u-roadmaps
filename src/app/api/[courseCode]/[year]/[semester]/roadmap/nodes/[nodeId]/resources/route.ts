import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import {
  createRoadmapResource,
  getRoadmapNodeResources,
  uploadRoadmapResource,
} from '@/features/roadmap/server';

export const POST = courseRoute(async ({ identifier, user, params, request }) => {
  const target = { userId: user.id, identifier, id: params.nodeId };
  const isUpload = request.headers.get('content-type')?.startsWith('multipart/form-data');
  const resource = await (isUpload
    ? uploadRoadmapResource(
        { ...target, file: (await request.formData()).get('file') },
        roadmapChangePort,
      )
    : createRoadmapResource(
        { ...target, input: await parseJsonObject(request) },
        roadmapChangePort,
      ));
  return NextResponse.json({ resource }, { status: 201 });
});

export const GET = courseRoute(async ({ identifier, user, params }) => {
  const resources = await getRoadmapNodeResources({
    userId: user.id,
    identifier,
    nodeId: params.nodeId,
  });
  return NextResponse.json({ resources });
});
