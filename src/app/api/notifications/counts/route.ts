import { authenticatedJson } from '@/app/_adapters/http';
import { countOwnNotices } from '@/features/notifications/server';
export const GET = authenticatedJson((user, request) =>
  countOwnNotices(user.id, new URL(request.url).searchParams),
);
