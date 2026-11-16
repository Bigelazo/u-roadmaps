import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { courseRoute, fileDownloadResponse } from '@/app/_adapters/http';
import { downloadRoadmapResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user, params }) =>
  fileDownloadResponse(
    await downloadRoadmapResource(
      { userId: user.id, identifier, resourceId: params.resourceId },
      roadmapChangePort,
    ),
  ),
);
