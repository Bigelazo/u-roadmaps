import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { downloadRoadmapResource } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const GET = courseRoute(async ({ identifier, user, params }) => {
  const download = await unwrap(() =>
    downloadRoadmapResource(
      { actor: user, identifier, resourceId: params.resourceId },
      roadmapChangePort,
    ),
  );
  return new NextResponse(Uint8Array.from(download.bytes).buffer, {
    headers: {
      'Content-Type': download.contentType,
      'Content-Length': String(download.bytes.byteLength),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(download.title)}`,
      'Cache-Control': 'private, no-store',
    },
  });
});
