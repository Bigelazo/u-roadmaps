import { beforeEach, expect, it, vi } from 'vitest';

type StoredUser = {
  id: string;
  tutorialInvitationShownAt?: Date | null;
  postCreationInvitationShownAt: Date | null;
  teachingTutorialOpenedAt: Date | null;
};

// In-memory stand-in for the User and Roadmap tables these functions read and stamp.
const store = vi.hoisted(() => ({
  users: new Map<string, StoredUser>(),
  createdRoadmaps: new Map<string, string[]>(),
}));

vi.mock('@/shared/server/db', () => {
  const matches = (user: StoredUser, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => user[key as keyof StoredUser] === value);
  return {
    prisma: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          store.users.get(where.id) ?? null,
        updateMany: async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<StoredUser>;
        }) => {
          const user = store.users.get(where.id as string);
          if (!user || !matches(user, where)) return { count: 0 };
          Object.assign(user, data);
          return { count: 1 };
        },
      },
      roadmap: {
        findMany: async ({ where, take }: { where: { creatorId: string }; take: number }) =>
          (store.createdRoadmaps.get(where.creatorId) ?? []).slice(0, take).map((id) => ({ id })),
      },
    },
  };
});

import {
  claimTutorialInvitation,
  readPostCreationInvitation,
  recordPracticeRoadmapOpened,
} from '@/features/roadmap/application/tutorial-invitation';

const professor = '11111111-1111-4111-8111-111111111111';
const firstRoadmap = '22222222-2222-4222-8222-222222222222';
const secondRoadmap = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  store.users.clear();
  store.createdRoadmaps.clear();
  store.users.set(professor, {
    id: professor,
    postCreationInvitationShownAt: null,
    teachingTutorialOpenedAt: null,
  });
});

it('invites to do the teaching tutorial after the first Roadmap creation', async () => {
  store.createdRoadmaps.set(professor, [firstRoadmap]);
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toEqual({
    wording: 'hacer',
  });
});

it('keeps inviting until the invitation is shown', async () => {
  store.createdRoadmaps.set(professor, [firstRoadmap]);
  await readPostCreationInvitation(professor, firstRoadmap);
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toEqual({
    wording: 'hacer',
  });
});

it('never invites again after the invitation was shown', async () => {
  store.createdRoadmaps.set(professor, [firstRoadmap]);
  await expect(claimTutorialInvitation(professor, 'post-creation')).resolves.toBe(true);
  await expect(claimTutorialInvitation(professor, 'post-creation')).resolves.toBe(false);
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toBeNull();
});

it('invites to repeat the teaching tutorial when it was opened before', async () => {
  store.createdRoadmaps.set(professor, [firstRoadmap]);
  await recordPracticeRoadmapOpened(professor, 'teaching');
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toEqual({
    wording: 'repetir',
  });
});

it('keeps inviting to do the teaching tutorial after only the student tutorial', async () => {
  store.createdRoadmaps.set(professor, [firstRoadmap]);
  await recordPracticeRoadmapOpened(professor, 'student');
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toEqual({
    wording: 'hacer',
  });
});

it('does not invite a User who created no Roadmap or several before', async () => {
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toBeNull();
  store.createdRoadmaps.set(professor, [firstRoadmap, secondRoadmap]);
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toBeNull();
});

it('does not invite on a Roadmap the User did not create', async () => {
  store.createdRoadmaps.set(professor, [secondRoadmap]);
  await expect(readPostCreationInvitation(professor, firstRoadmap)).resolves.toBeNull();
});

it('keeps the first teaching tutorial opening', async () => {
  await recordPracticeRoadmapOpened(professor, 'teaching');
  const first = store.users.get(professor)!.teachingTutorialOpenedAt;
  await recordPracticeRoadmapOpened(professor, 'teaching');
  expect(store.users.get(professor)!.teachingTutorialOpenedAt).toBe(first);
});
