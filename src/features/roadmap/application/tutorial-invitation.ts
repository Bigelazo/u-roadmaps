import 'server-only';

import { prisma } from '@/shared/server/db';
import type {
  PostCreationInvitationWording,
  PracticeExperience,
  TutorialInvitation,
} from '../types';
import { claimUserMilestone } from './user-milestone';

export type PostCreationInvitation = Readonly<{ wording: PostCreationInvitationWording }>;

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

export async function recordPracticeRoadmapOpened(
  userId: string,
  experience: PracticeExperience,
  now = new Date(),
) {
  await claimUserMilestone(userId, 'tutorialInvitationShownAt', now);
  if (experience === 'teaching') await claimUserMilestone(userId, 'teachingTutorialOpenedAt', now);
}
