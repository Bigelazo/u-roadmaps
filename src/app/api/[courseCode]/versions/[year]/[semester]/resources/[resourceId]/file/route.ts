import { courseRoute, fileDownloadResponse } from '@/app/_adapters/http';
import { downloadRoadmapVersionResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ request, actor, user, params }) =>
  fileDownloadResponse(
    await downloadRoadmapVersionResource(user, actor.identifier, params.resourceId),
    request,
  ),
);
