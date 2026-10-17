import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { downloadRoadmapResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user, params }) => {
  const download = await downloadRoadmapResource({
    userId: user.id,
    identifier,
    resourceId: params.resourceId,
  });
  return new NextResponse(Uint8Array.from(download.bytes).buffer, {
    headers: {
      'Content-Type': download.contentType,
      'Content-Length': String(download.bytes.byteLength),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(download.title)}`,
      'Cache-Control': 'private, no-store',
    },
  });
});
