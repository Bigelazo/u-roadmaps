// Exercise the SDK's server exports, rather than the browser exports or mocks.
// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Keep the real provider/hooks while preventing the SDK from opening a cloud session.
vi.stubGlobal(
  'fetch',
  vi.fn(async () => new Response('{"message":"Test transport"}', { status: 401 })),
);

import {
  NotificationsInbox,
  NotificationsProvider,
} from '@/features/notifications/components/NotificationsInbox';

test('renders the authenticated Inbox with the real Novu context during SSR', () => {
  const identity = {
    subscriber: 'test-subscriber',
    subscriberHash: 'test-hash',
    applicationIdentifier: 'test-application',
  };

  expect(
    renderToString(
      <NotificationsProvider identity={identity}>
        <NotificationsInbox identity={identity} />
      </NotificationsProvider>,
    ),
  ).toContain('Avisos');
});
