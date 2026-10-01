import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult } from '@/app/_adapters/http';
import { countOwnNotices } from '@/features/notifications/server';
export async function GET(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await countOwnNotices(user.id, new URL(request.url).searchParams));
  });
}
