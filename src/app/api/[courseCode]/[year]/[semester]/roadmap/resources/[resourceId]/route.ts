import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseFormData, parseJsonObject } from '@/app/_adapters/http';
import {
  removeRoadmapResource,
  replaceRoadmapResourceFile,
  updateRoadmapResource,
} from '@/features/roadmap/server';

export const PATCH = courseRoute(async ({ actor, params, request }) => {
  const target = { ...actor, id: params.resourceId };
  const isUpload = request.headers.get('content-type')?.startsWith('multipart/form-data');
  if (isUpload) {
    const form = await parseFormData(request);
    const result = await replaceRoadmapResourceFile(
      { ...target, file: form.get('file'), title: form.get('title') },
      roadmapChangePort,
    );
    return NextResponse.json({ resource: result.resource });
  }
  const result = await updateRoadmapResource(
    { ...target, input: await parseJsonObject(request) },
    roadmapChangePort,
  );
  return NextResponse.json({ resource: result.resource });
});

export const DELETE = courseRoute(async ({ actor, params }) => {
  await removeRoadmapResource({ ...actor, id: params.resourceId }, roadmapChangePort);
  return new NextResponse(null, { status: 204 });
});
