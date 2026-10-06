import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { prepareOwnRoadmapOpening } from '@/features/notifications/server';

export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return Response.json(await prepareOwnRoadmapOpening(user.id, await parseJsonObject(request)));
  });
}
