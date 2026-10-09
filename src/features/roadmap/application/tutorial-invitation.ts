import 'server-only';

import { prisma } from '@/shared/server/db';
import type { PostCreationInvitationWording, PracticeExperience } from '../types';
import { claimUserMilestone } from './user-milestone';

/** The teaching tutorial invitation shown after a first Roadmap creation. */
export type PostCreationInvitation = Readonly<{ wording: PostCreationInvitationWording }>;

/** A tutorial invitation shown once per User. */
export type TutorialInvitation = 'first-visit' | 'post-creation';

/**
 * The invitation due when `roadmapId` is the only Roadmap the User has created and it
 * was never shown. Reading does not claim it: the dialog claims it once it shows.
 */
export async function readPostCreationInvitation(
  userId: string,
  roadmapId: string,
): Promise<PostCreationInvitation | null> {
  const created = await prisma.roadmap.findMany({
    where: { creatorId: userId },
    select: { id: true },
    take: 2,
  });
  if (created.length !== 1 || created[0].id !== roadmapId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { postCreationInvitationShownAt: true, teachingTutorialOpenedAt: true },
  });
  if (!user || user.postCreationInvitationShownAt) return null;
  return { wording: user.teachingTutorialOpenedAt ? 'repetir' : 'hacer' };
}

/** Records that the invitation was shown, so it never shows again; true the first time. */
export function claimTutorialInvitation(
  userId: string,
  invitation: TutorialInvitation,
  now = new Date(),
) {
  return claimUserMilestone(
    userId,
    invitation === 'first-visit' ? 'tutorialInvitationShownAt' : 'postCreationInvitationShownAt',
    now,
  );
}

/**
 * Records that the User opened a Roadmap tutorial on the Practice roadmap: the
 * first-visit invitation is no longer due, and a later post-creation invitation offers
 * to repeat the teaching tutorial once it was opened.
 */
export async function recordPracticeRoadmapOpened(
  userId: string,
  experience: PracticeExperience,
  now = new Date(),
) {
  await claimUserMilestone(userId, 'tutorialInvitationShownAt', now);
  if (experience === 'teaching') await claimUserMilestone(userId, 'teachingTutorialOpenedAt', now);
}
