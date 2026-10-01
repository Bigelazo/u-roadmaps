import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { getOwnNotice, markOwnNotice } from '@/features/notifications/server';

type Context = { params: Promise<{ noticeId: string }> };
export async function GET(_request: Request, context: Context) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await getOwnNotice(user.id, (await context.params).noticeId));
  });
}
export async function PATCH(request: Request, context: Context) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(
      await markOwnNotice(user.id, (await context.params).noticeId, await parseJsonObject(request)),
    );
  });
}
