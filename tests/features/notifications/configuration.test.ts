import { createHmac } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@/shared/server/db', () => ({ prisma: {} }));
vi.mock('@/features/notifications/infrastructure/novu-transport', () => ({
  novuTransport: {},
}));

import { getInboxIdentity, notificationsEnabled } from '@/features/notifications/server';

afterEach(() => vi.unstubAllEnvs());

test.each(['development', 'production', 'test'] as const)(
  'enables a signed Inbox with only the two credentials in %s',
  (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('NOVU_SECRET_KEY', 'test-secret');
    vi.stubEnv('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER', 'test-application');

    expect(notificationsEnabled()).toBe(true);
    expect(getInboxIdentity('subscriber-id')).toEqual({
      own: true,
      subscriber: 'subscriber-id',
      subscriberHash: createHmac('sha256', 'test-secret').update('subscriber-id').digest('hex'),
      applicationIdentifier: 'test-application',
    });
  },
);

test.each([
  [undefined, 'test-application'],
  ['test-secret', undefined],
  ['', 'test-application'],
  ['test-secret', ''],
  ['   ', 'test-application'],
  ['test-secret', '   '],
])('keeps the own Inbox enabled without legacy credentials', (secretKey, applicationIdentifier) => {
  vi.stubEnv('NOVU_SECRET_KEY', secretKey);
  vi.stubEnv('NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER', applicationIdentifier);

  expect(notificationsEnabled()).toBe(false);
  expect(getInboxIdentity('subscriber-id')).toEqual({
    own: true,
    subscriber: 'subscriber-id',
    subscriberHash: '',
    applicationIdentifier: '',
  });
});
