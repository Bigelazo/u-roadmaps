import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { recordLinkResourceAccess } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ identifier, user, params }) => {
  await recordLinkResourceAccess(
    { userId: user.id, identifier, resourceId: params.resourceId },
    roadmapChangePort,
  );
  return new NextResponse(null, { status: 204 });
});
