import { authenticatedJson, parseJsonObject } from '@/app/_adapters/http';
import { countOwnNodeChangeTargets, reviewOwnNode } from '@/features/notifications/server';
export const GET = authenticatedJson((user, request) =>
  countOwnNodeChangeTargets(user.id, new URL(request.url).searchParams),
);
export const POST = authenticatedJson(async (user, request) =>
  reviewOwnNode(user.id, await parseJsonObject(request)),
);
