import { courseRoute, fileDownloadResponse } from '@/app/_adapters/http';
import { downloadRoadmapVersionResource } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user, params }) =>
  fileDownloadResponse(await downloadRoadmapVersionResource(user, identifier, params.resourceId)),
);
