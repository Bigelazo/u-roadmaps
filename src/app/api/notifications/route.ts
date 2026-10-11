import { authenticatedJson } from '@/app/_adapters/http';
import { listOwnNotices } from '@/features/notifications/server';

export const GET = authenticatedJson((user, request) =>
  listOwnNotices(user.id, new URL(request.url).searchParams),
);
