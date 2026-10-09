import { beforeEach, expect, it, vi } from 'vitest';

type StoredUser = {
  id: string;
  postCreationInvitationShownAt: Date | null;
  teachingTutorialOpenedAt: Date | null;
};

// In-memory stand-in for the User and Roadmap tables these functions read and stamp.
const store = vi.hoisted(() => ({
  users: new Map<string, StoredUser>(),
  createdRoadmaps: new Map<string, number>(),
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
        count: async ({ where }: { where: { creatorId: string } }) =>
          store.createdRoadmaps.get(where.creatorId) ?? 0,
      },
    },
  };
});

import {
  claimPostCreationInvitation,
  recordTeachingTutorialOpened,
} from '@/features/roadmap/application/tutorial-invitation';

const professor = '11111111-1111-4111-8111-111111111111';

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
  store.createdRoadmaps.set(professor, 1);
  await expect(claimPostCreationInvitation(professor)).resolves.toEqual({ wording: 'hacer' });
});

it('never invites again after the invitation was shown', async () => {
  store.createdRoadmaps.set(professor, 1);
  await claimPostCreationInvitation(professor);
  store.createdRoadmaps.set(professor, 2);
  await expect(claimPostCreationInvitation(professor)).resolves.toBeNull();
});

it('invites to repeat the teaching tutorial when it was opened before', async () => {
  store.createdRoadmaps.set(professor, 1);
  await recordTeachingTutorialOpened(professor);
  await expect(claimPostCreationInvitation(professor)).resolves.toEqual({ wording: 'repetir' });
});

it('does not invite a User who created no Roadmap or several before', async () => {
  await expect(claimPostCreationInvitation(professor)).resolves.toBeNull();
  store.createdRoadmaps.set(professor, 2);
  await expect(claimPostCreationInvitation(professor)).resolves.toBeNull();
});

it('keeps the first teaching tutorial opening', async () => {
  await recordTeachingTutorialOpened(professor);
  const first = store.users.get(professor)!.teachingTutorialOpenedAt;
  await recordTeachingTutorialOpened(professor);
  expect(store.users.get(professor)!.teachingTutorialOpenedAt).toBe(first);
});
