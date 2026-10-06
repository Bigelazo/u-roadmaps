import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NotificationsProvider,
  RoadmapEntryNotifications,
  useNotificationAcknowledgement,
} from '@/features/notifications/components/NotificationsInbox';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider identity={{ userId: 'user-id' }}>
      <RoadmapEntryNotifications>{children}</RoadmapEntryNotifications>
    </NotificationsProvider>
  );
}
afterEach(() => vi.unstubAllGlobals());

test('a failed Roadmap recognition retries the same opening operation without absorbing later arrivals', async () => {
  const operations: { path: string; input: Record<string, unknown> }[] = [];
  let fail = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      operations.push({ path, input: JSON.parse(String(init.body)) });
      if (path.endsWith('/acknowledge') && fail) {
        fail = false;
        return Response.json({}, { status: 503 });
      }
      return Response.json({});
    }),
  );
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });
  const input = { roadmapId: 'roadmap-id', entryKey: 'opening-id' };
  await act(async () => expect(await result.current.acknowledge(input)).toBe(false));
  await act(async () => expect(await result.current.retry(input)).toBe(true));
  expect(operations.map(({ path }) => path)).toEqual([
    '/api/notifications/openings',
    '/api/notifications/acknowledge',
    '/api/notifications/openings',
    '/api/notifications/acknowledge',
  ]);
  const operationId = operations[0].input.operationId;
  expect(operationId).toEqual(expect.any(String));
  expect(operations[0].input).toEqual({ roadmapId: input.roadmapId, operationId, retry: false });
  expect(operations[2].input).toEqual({ roadmapId: input.roadmapId, operationId, retry: true });
  expect(operations[1].input).toEqual(operations[3].input);
});

test('a pruned Roadmap opening keeps retries failed and never recognizes a replacement opening', async () => {
  const operations: { path: string; input: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit) => {
      const input = JSON.parse(String(init.body));
      operations.push({ path, input });
      return Response.json(
        {},
        { status: operations.length === 1 ? 200 : operations.length === 2 ? 503 : 404 },
      );
    }),
  );
  const { result } = renderHook(() => useNotificationAcknowledgement(), { wrapper });
  const input = { roadmapId: 'roadmap-id', entryKey: 'opening-id' };
  await act(async () => expect(await result.current.acknowledge(input)).toBe(false));
  await act(async () => expect(await result.current.retry(input)).toBe(false));
  await act(async () => expect(await result.current.retry(input)).toBe(false));
  expect(operations.map(({ path }) => path)).toEqual([
    '/api/notifications/openings',
    '/api/notifications/acknowledge',
    '/api/notifications/openings',
    '/api/notifications/openings',
  ]);
  const operationId = operations[0].input.operationId;
  expect(operations.slice(2).map(({ input }) => input)).toEqual([
    { roadmapId: input.roadmapId, operationId, retry: true },
    { roadmapId: input.roadmapId, operationId, retry: true },
  ]);
});
