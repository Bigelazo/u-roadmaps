import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult } from '@/app/_adapters/http';
import { listOwnNotices } from '@/features/notifications/server';

export async function GET(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await listOwnNotices(user.id, new URL(request.url).searchParams));
  });
}
