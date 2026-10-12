import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import {
  createRoadmapResource,
  getRoadmapNodeResources,
  uploadRoadmapResource,
} from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const POST = courseRoute(async ({ identifier, user, params, request }) => {
  const target = { userId: user.id, identifier, id: params.nodeId };
  const resourceResult = request.headers.get('content-type')?.startsWith('multipart/form-data')
    ? uploadRoadmapResource(
        { ...target, file: (await request.formData()).get('file') },
        roadmapChangePort,
      )
    : createRoadmapResource(
        { ...target, input: await parseJsonObject(request) },
        roadmapChangePort,
      );
  const resource = await unwrap(() => resourceResult);
  return NextResponse.json({ resource }, { status: 201 });
});

export const GET = courseRoute(async ({ identifier, user, params }) => {
  const resources = await unwrap(() =>
    getRoadmapNodeResources({ actor: user, identifier, nodeId: params.nodeId }, roadmapChangePort),
  );
  return NextResponse.json({ resources });
});
