import { beforeEach, expect, it, vi } from 'vitest';

type StoredUser = { id: string; tutorialInvitationShownAt: Date | null };

// In-memory stand-in for the User table these functions stamp.
const store = vi.hoisted(() => ({ users: new Map<string, StoredUser>() }));

vi.mock('@/shared/server/db', () => ({
  prisma: {
    user: {
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<StoredUser>;
      }) => {
        const user = store.users.get(where.id as string);
        const matches = Object.entries(where).every(
          ([key, value]) => user?.[key as keyof StoredUser] === value,
        );
        if (!user || !matches) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      },
    },
  },
}));

import {
  claimFirstVisitInvitation,
  recordTutorialOpened,
} from '@/features/roadmap/application/first-visit-invitation';

const user = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  store.users.clear();
  store.users.set(user, { id: user, tutorialInvitationShownAt: null });
});

it('invites a User on their first Academic overview visit', async () => {
  await expect(claimFirstVisitInvitation(user)).resolves.toBe(true);
});

it('never invites the same User again', async () => {
  await claimFirstVisitInvitation(user);
  await expect(claimFirstVisitInvitation(user)).resolves.toBe(false);
});

it('does not invite a User who already opened a tutorial', async () => {
  await recordTutorialOpened(user);
  await expect(claimFirstVisitInvitation(user)).resolves.toBe(false);
});

it('keeps the first recorded time', async () => {
  const first = new Date('2026-10-01T12:00:00Z');
  await recordTutorialOpened(user, first);
  await recordTutorialOpened(user, new Date('2026-10-02T12:00:00Z'));
  expect(store.users.get(user)!.tutorialInvitationShownAt).toBe(first);
});
