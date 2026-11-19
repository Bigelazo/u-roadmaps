import { courseRoute, fileDownloadResponse } from '@/app/_adapters/http';
import { downloadRoadmapVersionResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ request, identifier, user, params }) =>
  fileDownloadResponse(
    await downloadRoadmapVersionResource(user, identifier, params.resourceId),
    request,
  ),
);
