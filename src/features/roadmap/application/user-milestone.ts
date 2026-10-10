import 'server-only';

import { prisma } from '@/shared/server/db';

/** A User timestamp recorded once: later records keep the first time. */
export type UserMilestone =
  'tutorialInvitationShownAt' | 'postCreationInvitationShownAt' | 'teachingTutorialOpenedAt';

/** Records `milestone` for the User unless it was already recorded; true when it was not. */
export async function claimUserMilestone(
  userId: string,
  milestone: UserMilestone,
  now = new Date(),
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, [milestone]: null },
    data: { [milestone]: now },
  });
  return count > 0;
}
