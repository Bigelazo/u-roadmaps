import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { downloadRoadmapVersionResource } from '@/features/roadmap/server';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/versions/[year]/[semester]/resources/[resourceId]/file'>,
) {
  return handleApplicationResult(async () => {
    const params = await context.params;
    const identifier = requireCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser();
    const download = await downloadRoadmapVersionResource(
      actor,
      identifier,
      params.resourceId,
    ).match((value) => value, throwApplicationError);
    return new NextResponse(Uint8Array.from(download.bytes).buffer, {
      headers: {
        'Content-Type': download.contentType,
        'Content-Length': String(download.bytes.byteLength),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(download.title)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
