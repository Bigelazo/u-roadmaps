import { authenticatedJson } from '@/app/_adapters/http';
import { getOwnNotice } from '@/features/notifications/server';

type Context = { params: Promise<{ noticeId: string }> };
export const GET = authenticatedJson(async (user, _request, context: Context) =>
  getOwnNotice(user.id, (await context.params).noticeId),
);
