import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { countOwnNodeChangeTargets, reviewOwnNode } from '@/features/notifications/server';
export async function GET(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(
      await countOwnNodeChangeTargets(user.id, new URL(request.url).searchParams),
    );
  });
}
export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await reviewOwnNode(user.id, await parseJsonObject(request)));
  });
}
