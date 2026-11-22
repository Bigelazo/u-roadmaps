import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { recordLinkResourceAccess } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ actor, params }) => {
  await recordLinkResourceAccess({ ...actor, resourceId: params.resourceId }, roadmapChangePort);
  return new NextResponse(null, { status: 204 });
});
