import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult } from '@/app/_adapters/http';
import { getOwnNotice } from '@/features/notifications/server';

type Context = { params: Promise<{ noticeId: string }> };
export async function GET(_request: Request, context: Context) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await getOwnNotice(user.id, (await context.params).noticeId));
  });
}
