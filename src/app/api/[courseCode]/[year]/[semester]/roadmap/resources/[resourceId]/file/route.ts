import { arrivesFromAnotherSite } from '@/app/_adapters/cross-site-mutation';
import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { courseRoute, fileDownloadResponse } from '@/app/_adapters/http';
import { downloadRoadmapResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ request, actor, params }) =>
  fileDownloadResponse(
    await downloadRoadmapResource(
      {
        ...actor,
        resourceId: params.resourceId,
        recordsAccess: !arrivesFromAnotherSite(request),
      },
      roadmapChangePort,
    ),
    request,
  ),
);
