import { authenticatedJson, parseJsonObject } from '@/app/_adapters/http';
import { prepareOwnRoadmapOpening } from '@/features/notifications/server';

export const POST = authenticatedJson(async (user, request) =>
  prepareOwnRoadmapOpening(user.id, await parseJsonObject(request)),
);
