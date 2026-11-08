import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import {
  removeRoadmapResource,
  replaceRoadmapResourceFile,
  updateRoadmapResource,
} from '@/features/roadmap/server';

export const PATCH = courseRoute(async ({ identifier, user, params, request }) => {
  const target = { userId: user.id, identifier, id: params.resourceId };
  const isUpload = request.headers.get('content-type')?.startsWith('multipart/form-data');
  if (isUpload) {
    const form = await request.formData();
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

export const DELETE = courseRoute(async ({ identifier, user, params }) => {
  await removeRoadmapResource(
    { userId: user.id, identifier, id: params.resourceId },
    roadmapChangePort,
  );
  return new NextResponse(null, { status: 204 });
});
