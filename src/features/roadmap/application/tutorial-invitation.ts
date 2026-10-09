import 'server-only';

import { prisma } from '@/shared/server/db';
import type { PostCreationInvitationWording } from '../types';

/** The teaching tutorial invitation shown after a first Roadmap creation. */
export type PostCreationInvitation = Readonly<{ wording: PostCreationInvitationWording }>;

/**
 * Claims the invitation when `roadmapId` is the only Roadmap the User has created.
 * It is recorded as shown here, once, so later Roadmap creations never show it.
 */
export async function claimPostCreationInvitation(
  userId: string,
  roadmapId: string,
  now = new Date(),
): Promise<PostCreationInvitation | null> {
  const created = await prisma.roadmap.findMany({
    where: { creatorId: userId },
    select: { id: true },
    take: 2,
  });
  if (created.length !== 1 || created[0].id !== roadmapId) return null;
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
