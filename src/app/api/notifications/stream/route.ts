import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult } from '@/app/_adapters/http';
import { openNotificationStream } from '@/features/notifications/server';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    return openNotificationStream(user.id, request.signal);
  });
}
