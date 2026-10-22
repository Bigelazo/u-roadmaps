import 'server-only';

import { prisma } from '@/shared/server/db';

export async function isFirstVisitInvitationDue(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tutorialInvitationShownAt: true },
  });
  return user?.tutorialInvitationShownAt === null;
}
