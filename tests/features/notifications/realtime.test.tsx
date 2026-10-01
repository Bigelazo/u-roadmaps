import { render, act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ROADMAP_CHANGE_RECEIVED_EVENT } from '@/features/roadmap/session/change-signal';

const { listeners, list, countsRefetch, feedRefetch } = vi.hoisted(() => ({
  listeners: new Map<string, (event: unknown) => void>(),
  list: vi.fn(),
  countsRefetch: vi.fn(async () => undefined),
  feedRefetch: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@novu/nextjs/hooks', () => ({
  NovuProvider: ({ children }: { children: React.ReactNode }) => children,
  useCounts: () => ({ counts: [{ count: 1 }], refetch: countsRefetch }),
  useNotifications: () => ({ notifications: [], refetch: feedRefetch }),
  useNovu: () => ({
    on: (name: string, callback: (event: unknown) => void) => {
      listeners.set(name, callback);
      return () => listeners.delete(name);
    },
    notifications: { list },
  }),
}));
import {
  NotificationsProvider,
  NotificationsInbox,
  NotificationCountButton,
} from '@/features/notifications/components/NotificationsInbox';

test('the real SDK callback invalidates only valid Roadmap changes without acknowledging arrival', () => {
  const changed = vi.fn();
  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
  const { unmount } = render(
    <NotificationsProvider
      identity={{ subscriber: 'user', subscriberHash: 'hash', applicationIdentifier: 'app' }}
    >
      <span>Roadmap</span>
    </NotificationsProvider>,
  );
  const received = listeners.get('notifications.notification_received');
  expect(received).toBeTypeOf('function');
  const data = { courseCode: 'CC1002', year: 2026, semester: 2, changeKind: 'node-updated' };
  act(() => received?.({ result: { data } }));
  expect(changed).toHaveBeenCalledOnce();
  expect(changed.mock.calls[0][0].detail).toEqual({
    courseCode: 'CC1002',
    year: 2026,
    semester: 2,
  });
  for (const invalid of [
    { ...data, changeKind: 'unrelated' },
    { ...data, semester: 3 },
    { ...data, year: NaN },
    { ...data, courseCode: '' },
  ]) {
    act(() => received?.({ result: { data: invalid } }));
  }
  expect(changed).toHaveBeenCalledOnce();
  expect(list).not.toHaveBeenCalled();
  unmount();
  expect(listeners.has('notifications.notification_received')).toBe(false);
  window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
});

test('socket reconnection repairs feed and filtered counts without reading notices', async () => {
  const identity = { subscriber: 'user', subscriberHash: 'hash', applicationIdentifier: 'app' };
  const { unmount } = render(
    <NotificationsProvider identity={identity}>
      <NotificationsInbox identity={identity} />
      <NotificationCountButton filter={{ roadmapId: 'roadmap' }} label="Roadmap" />
    </NotificationsProvider>,
  );
  await act(async () => {
    listeners.get('socket.connect.resolved')?.({});
  });
  expect(countsRefetch).toHaveBeenCalledTimes(2);
  expect(feedRefetch).toHaveBeenCalledOnce();
  expect(list).not.toHaveBeenCalled();
  unmount();
  expect(listeners.has('socket.connect.resolved')).toBe(false);
});
