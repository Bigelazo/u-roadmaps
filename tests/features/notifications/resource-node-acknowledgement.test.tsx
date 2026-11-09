import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NotificationsProvider,
  RoadmapEntryNotifications,
  useNotificationAcknowledgement,
} from '@/features/notifications/components/NotificationsInbox';
import { NodeName } from '@/features/roadmap/ui/NodeName';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider identity={{ userId: 'user-id' }}>
      <RoadmapEntryNotifications NodeName={NodeName}>{children}</RoadmapEntryNotifications>
    </NotificationsProvider>
  );
}
afterEach(() => vi.unstubAllGlobals());

test('a failed Roadmap acknowledgement returns false', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) =>
      path.endsWith('/acknowledge') ? Response.json({}, { status: 503 }) : Response.json({}),
    ),
  );
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });
  const input = { roadmapId: 'roadmap-id', entryKey: 'opening-id' };
  await act(async () => expect(await result.current.acknowledge(input)).toBe(false));
});

test('a Roadmap acknowledgement opens and acknowledges the same operation', async () => {
  const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
    Response.json({ acknowledged: 0, summary: null }),
  );
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });
  const input = { roadmapId: 'roadmap-id', entryKey: 'opening-id' };
  await act(async () => expect(await result.current.acknowledge(input)).toBe(true));
  const posts = fetch.mock.calls.filter(
    ([path]) => path.endsWith('/openings') || path.endsWith('/acknowledge'),
  );
  expect(posts.map(([path]) => path.split('/').at(-1))).toEqual(['openings', 'acknowledge']);
  const [opening, acknowledgement] = posts.map(([, init]) => JSON.parse(String(init?.body)));
  expect(opening).toEqual({ roadmapId: 'roadmap-id', operationId: expect.any(String) });
  expect(acknowledgement).toEqual(opening);
});
