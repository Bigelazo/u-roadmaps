import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { recordCanvasPreviewResourceReview } from '@/features/roadmap/server';

export const POST = courseRoute(async ({ identifier, user, params }) => {
  await recordCanvasPreviewResourceReview(
    { userId: user.id, identifier, resourceId: params.resourceId },
    roadmapChangePort,
  );
  return new NextResponse(null, { status: 204 });
});
