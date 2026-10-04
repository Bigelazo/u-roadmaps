// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import {
  NotificationsInbox,
  NotificationsProvider,
} from '@/features/notifications/components/NotificationsInbox';

test('renders the authenticated Inbox with the own provider during SSR', () => {
  const identity = {
    userId: 'test-user',
  };

  expect(
    renderToString(
      <NotificationsProvider identity={identity}>
        <NotificationsInbox identity={identity} />
      </NotificationsProvider>,
    ),
  ).toContain('Avisos');
});
