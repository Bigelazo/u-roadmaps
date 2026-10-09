import 'server-only';

import { prisma } from '@/shared/server/db';

/**
 * Claims the first-visit tutorial invitation on the Academic overview. It is recorded as
 * shown here, once, so it never appears again on any browser or device.
 */
export async function claimFirstVisitInvitation(userId: string, now = new Date()) {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, tutorialInvitationShownAt: null },
    data: { tutorialInvitationShownAt: now },
  });
  return count > 0;
}

/** Records that the User opened a tutorial, so the first-visit invitation is not shown. */
export async function recordTutorialOpened(userId: string, now = new Date()) {
  await claimFirstVisitInvitation(userId, now);
}
