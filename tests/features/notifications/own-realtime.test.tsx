import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  NotificationsProvider,
  NotificationsInbox,
  NotificationCountButton,
} from '@/features/notifications/components/NotificationsInbox';
import { useCounts, useNotifications } from '@/features/notifications/components/inbox-driver';
import {
  ROADMAP_CHANGE_RECEIVED_EVENT,
  requestRoadmapRecovery,
} from '@/shared/client/roadmap-events';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
class BrowserStream extends EventTarget {
  static instances: BrowserStream[] = [];
  closed = false;
  constructor() {
    super();
    BrowserStream.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  receive(kind: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(kind, { data: JSON.stringify(data) }));
  }
}
function InboxProjection() {
  const { counts } = useCounts({ filters: [{ read: false }] });
  const { notifications } = useNotifications({ read: false });
  return (
    <p>
      {counts?.[0].count} pending: {notifications?.map((record) => record.subject).join(', ')}
    </p>
  );
}
const identity = (subscriber: string) => ({
  userId: subscriber,
});
function inbox(children: ReactNode, subscriber: string | null = 'student') {
  return (
    <NotificationsProvider identity={subscriber ? identity(subscriber) : null}>
      {children}
    </NotificationsProvider>
  );
}
const renderInbox = (children: ReactNode, subscriber?: string | null) =>
  render(inbox(children, subscriber));
function stubFetch<T extends (url: string, init?: RequestInit) => Promise<Response>>(handler: T) {
  const fetch = vi.fn(handler);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
beforeEach(() => {
  vi.stubGlobal('EventSource', BrowserStream);
});
afterEach(() => {
  vi.unstubAllGlobals();
  BrowserStream.instances = [];
});

test('one shared stream updates feed and counters without recognizing arrival and discards another User', async () => {
  let delivered = false;
  const fetch = stubFetch(async (url: string) =>
    Response.json(
      url.includes('/counts')
        ? { count: delivered ? 1 : 0 }
        : {
            notifications: delivered
              ? [{ id: 'notice', subject: 'Node edited', createdAt: '2026-10-03' }]
              : [],
            hasMore: false,
          },
    ),
  );
  const { unmount } = renderInbox(
    <>
      <InboxProjection />
      <InboxProjection />
    </>,
  );
  await waitFor(() => expect(screen.getAllByText('0 pending:')).toHaveLength(2));
  expect(BrowserStream.instances).toHaveLength(1);
  delivered = true;
  act(() => BrowserStream.instances[0].receive('inbox', { userId: 'other' }));
  expect(screen.getAllByText('0 pending:')).toHaveLength(2);
  act(() => BrowserStream.instances[0].receive('inbox', { userId: 'student' }));
  await waitFor(() => expect(screen.getAllByText('1 pending: Node edited')).toHaveLength(2));
  expect(fetch.mock.calls.every(([url]) => !url.includes('acknowledge'))).toBe(true);
  unmount();
  expect(BrowserStream.instances[0].closed).toBe(true);
});

test('switching User closes the old stream and ignores its queued events', async () => {
  stubFetch(async () => Response.json({ notifications: [], hasMore: false, count: 0 }));
  const changed = vi.fn();
  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
  const { rerender, unmount } = renderInbox(<span>Session</span>, 'first');
  const old = BrowserStream.instances[0];
  rerender(inbox(<span>Session</span>, 'second'));
  expect(old.closed).toBe(true);
  const change = { courseCode: 'CC1002', year: 2026, semester: 2 };
  act(() => old.receive('roadmap', { ...change, userId: 'first' }));
  expect(changed).not.toHaveBeenCalled();
  act(() => BrowserStream.instances[1].receive('roadmap', { ...change, userId: 'second' }));
  expect(changed.mock.calls[0][0].detail).toEqual(change);
  act(() =>
    BrowserStream.instances[1].receive('roadmap', {
      ...change,
      userId: 'second',
      accessLost: true,
    }),
  );
  expect(changed.mock.calls[1][0].detail).toEqual({ ...change, accessLost: true });
  rerender(inbox(<span>Logged out</span>, null));
  expect(BrowserStream.instances[1].closed).toBe(true);
  unmount();
  window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, changed);
});

test('a transient Inbox refresh preserves saved data and retries without another signal', async () => {
  let refreshing = false;
  let failed = false;
  stubFetch(async (url: string) => {
    if (refreshing && !failed && url.includes('/counts')) {
      failed = true;
      throw new Error('Temporary network failure');
    }
    return Response.json(
      url.includes('/counts')
        ? { count: refreshing ? 1 : 0 }
        : { notifications: [], hasMore: false },
    );
  });
  renderInbox(<InboxProjection />);
  await screen.findByText('0 pending:');
  refreshing = true;
  act(() => BrowserStream.instances[0].receive('inbox', { userId: 'student' }));
  expect(screen.getByText('0 pending:')).toBeTruthy();
  await screen.findByText('1 pending:', {}, { timeout: 2500 });
});

test('foreground recovery retries actual counters after overlapping HTTP failures without another signal', async () => {
  let refreshing = false;
  let available = true;
  stubFetch(async (url: string) => {
    if (!available) throw new Error('Temporary outage');
    return Response.json(
      url.includes('/counts')
        ? { count: refreshing ? 2 : 0 }
        : { notifications: [], hasMore: false },
    );
  });
  renderInbox(
    <>
      <InboxProjection />
      <NotificationCountButton filter={{ roadmapId: 'roadmap' }} label="Roadmap" />
    </>,
  );
  await screen.findByText('0 pending:');
  refreshing = true;
  available = false;
  await act(async () => requestRoadmapRecovery());
  await screen.findByRole('button', { name: 'Avisos para Roadmap, contador no disponible' });
  available = true;
  expect(
    await screen.findByRole(
      'button',
      { name: '2 avisos sin leer para Roadmap' },
      { timeout: 2500 },
    ),
  ).toBeTruthy();
});

test('a closed SSE connection retries and its retry is cancelled on logout', async () => {
  const { rerender } = renderInbox(<span>Session</span>);
  const first = BrowserStream.instances[0];
  Object.defineProperty(first, 'readyState', { value: 2 });
  act(() => first.dispatchEvent(new Event('error')));
  await waitFor(() => expect(BrowserStream.instances).toHaveLength(2), { timeout: 2500 });
  expect(first.closed).toBe(true);
  const second = BrowserStream.instances[1];
  Object.defineProperty(second, 'readyState', { value: 2 });
  act(() => second.dispatchEvent(new Event('error')));
  rerender(inbox(<span>Logged out</span>, null));
  expect(second.closed).toBe(true);
});

test('an Inbox refresh failure keeps saved notices visible while offering retry', async () => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  let available = true;
  stubFetch(async (url: string) => {
    if (!available && !url.includes('/counts')) throw new Error('Temporary outage');
    return Response.json(
      url.includes('/counts')
        ? { count: 1 }
        : {
            notifications: [
              { id: 'notice', subject: 'Saved Node change', createdAt: '2026-10-03' },
            ],
            hasMore: false,
          },
    );
  });
  renderInbox(<NotificationsInbox identity={identity('student')} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos, 1 sin leer' }));
  await screen.findByRole('button', { name: /Saved Node change/ });
  available = false;
  act(() => BrowserStream.instances[0].receive('inbox', { userId: 'student' }));
  await screen.findByText('No se pudieron cargar los avisos.');
  expect(screen.getByRole('button', { name: /Saved Node change/ })).toBeTruthy();
});

test('going offline closes the tab stream and returning online opens a real replacement', () => {
  renderInbox(<span>Session</span>);
  const first = BrowserStream.instances[0];
  act(() => window.dispatchEvent(new Event('offline')));
  expect(first.closed).toBe(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(BrowserStream.instances).toHaveLength(2);
});

function PagedInboxProjection() {
  const { notifications, fetchMore, isFetching } = useNotifications({ limit: 10 });
  return (
    <>
      <ul>
        {notifications?.map((notice) => (
          <li key={notice.id}>{notice.subject}</li>
        ))}
      </ul>
      <button disabled={isFetching} onClick={() => void fetchMore()}>
        Load next page
      </button>
    </>
  );
}

test('an SSE refresh preserves expanded Inbox pages and updates their saved notices', async () => {
  let refreshed = false;
  stubFetch(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const start = params.get('after') === 'notice-10' ? 10 : 0;
    return Response.json({
      notifications: Array.from({ length: 10 }, (_, offset) => ({
        id: `notice-${start + offset + 1}`,
        subject:
          refreshed && start + offset === 0
            ? 'Updated first notice'
            : `Notice ${start + offset + 1}`,
        createdAt: '2026-10-03',
      })),
      hasMore: start === 0,
    });
  });
  renderInbox(<PagedInboxProjection />);
  await screen.findByText('Notice 10');
  await userEvent.click(screen.getByRole('button', { name: 'Load next page' }));
  await screen.findByText('Notice 20');
  refreshed = true;
  act(() => BrowserStream.instances[0].receive('inbox', { userId: 'student' }));
  await screen.findByText('Updated first notice');
  expect(screen.getAllByRole('listitem')).toHaveLength(20);
  expect(screen.getByText('Notice 20')).toBeTruthy();
});

test('a burst of Inbox signals refreshes once without marking shown rows', async () => {
  const fetch = stubFetch<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
    Response.json(
      url.includes('/counts')
        ? { count: 1 }
        : url.endsWith('/notice')
          ? { id: 'notice', subject: 'Saved Node change', createdAt: '2026-10-03' }
          : {
              notifications: [
                { id: 'notice', subject: 'Saved Node change', createdAt: '2026-10-03' },
              ],
              hasMore: false,
            },
    ),
  );
  renderInbox(<NotificationsInbox identity={identity('student')} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Avisos, 1 sin leer' }));
  await screen.findByRole('button', { name: /Saved Node change/ });
  const mutations = () =>
    fetch.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET').length;
  const feedRequests = () =>
    fetch.mock.calls.filter(([url]) => new URL(url, 'http://localhost').searchParams.has('limit'))
      .length;
  await waitFor(() => expect(mutations()).toBe(0));
  const before = feedRequests();
  act(() => {
    for (let signal = 0; signal < 5; signal++)
      BrowserStream.instances[0].receive('inbox', { userId: 'student' });
  });
  await waitFor(() => expect(feedRequests()).toBe(before + 1));
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(feedRequests()).toBe(before + 1);
  expect(mutations()).toBe(0);
});
