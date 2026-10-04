import { expect, test, vi } from 'vitest';
vi.mock('@/shared/server/db', () => ({ prisma: {} }));
import { getInboxIdentity } from '@/features/notifications/server';

test('identifies the authenticated Inbox by User without provider configuration', () => {
  expect(getInboxIdentity('user-id')).toEqual({ userId: 'user-id' });
});
