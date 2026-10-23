import 'server-only';

import { prisma } from '@/shared/server/db';

export type UserMilestone =
  'tutorialInvitationShownAt' | 'postCreationInvitationShownAt' | 'teachingTutorialOpenedAt';

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
