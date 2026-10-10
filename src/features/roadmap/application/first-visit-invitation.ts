import 'server-only';

import { prisma } from '@/shared/server/db';

/**
 * Whether the Academic overview should show the first-visit tutorial invitation: it was
 * never shown and the User never opened a tutorial. Showing it claims it, from the client.
 */
export async function isFirstVisitInvitationDue(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tutorialInvitationShownAt: true },
  });
  return user?.tutorialInvitationShownAt === null;
}
