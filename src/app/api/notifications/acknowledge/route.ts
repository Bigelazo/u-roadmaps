import { authenticatedJson, parseJsonObject } from '@/app/_adapters/http';
import { acknowledgeOwnNotices } from '@/features/notifications/server';
export const POST = authenticatedJson(async (user, request) =>
  acknowledgeOwnNotices(user.id, await parseJsonObject(request)),
);
