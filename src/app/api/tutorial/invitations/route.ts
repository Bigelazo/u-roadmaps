import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { handleApplicationResult, parseJsonObject } from '@/app/_adapters/http';
import { claimTutorialInvitation, isTutorialInvitation } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/server';

/**
 * Claims a tutorial invitation once its dialog shows, so it never shows again. Whether it
 * is due is decided when the page renders; a claim only ever hides the User's own
 * invitation, so it is not checked again here.
 */
export async function POST(request: Request) {
  return handleApplicationResult(async () => {
    const user = await requireAuthenticatedUser();
    const { invitation } = await parseJsonObject(request);
    if (!isTutorialInvitation(invitation))
      throw new ApplicationError(400, 'INVALID_REQUEST', 'Invitación desconocida.');
    return Response.json({ claimed: await claimTutorialInvitation(user.id, invitation) });
  });
}
