import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { downloadRoadmapResource } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; resourceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const download = await downloadRoadmapResource({
      actor,
      identifier,
      resourceId: params.resourceId,
    }).match((value) => value, throwApiError);
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
