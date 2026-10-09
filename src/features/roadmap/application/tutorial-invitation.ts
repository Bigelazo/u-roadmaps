import 'server-only';

import { prisma } from '@/shared/server/db';

/** The teaching tutorial invitation shown after a first Roadmap creation. */
export type PostCreationInvitation = Readonly<{ wording: 'hacer' | 'repetir' }>;

/**
 * Claims the invitation for a User whose only created Roadmap is the one just created.
 * It is recorded as shown here, once, so later Roadmap creations never show it.
 */
export async function claimPostCreationInvitation(
  userId: string,
  now = new Date(),
): Promise<PostCreationInvitation | null> {
  if ((await prisma.roadmap.count({ where: { creatorId: userId } })) !== 1) return null;
  const { count } = await prisma.user.updateMany({
    where: { id: userId, postCreationInvitationShownAt: null },
    data: { postCreationInvitationShownAt: now },
  });
  if (count === 0) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teachingTutorialOpenedAt: true },
  });
  return { wording: user?.teachingTutorialOpenedAt ? 'repetir' : 'hacer' };
}

/** Records the first time the User opens the teaching tutorial. */
export async function recordTeachingTutorialOpened(userId: string, now = new Date()) {
  await prisma.user.updateMany({
    where: { id: userId, teachingTutorialOpenedAt: null },
    data: { teachingTutorialOpenedAt: now },
  });
}
