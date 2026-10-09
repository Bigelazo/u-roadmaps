import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { claimTutorialInvitation, type TutorialInvitation } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/server';

const invitations: readonly TutorialInvitation[] = ['first-visit', 'post-creation'];

/** Claims a tutorial invitation once its dialog shows, so it never shows again. */
export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    const { invitation } = await parseJsonObject(request);
    const known = invitations.find((candidate) => candidate === invitation);
    if (!known) throw new ApplicationError(400, 'INVALID_REQUEST', 'Invitación desconocida.');
    return Response.json({ claimed: await claimTutorialInvitation(user.id, known) });
  });
}
