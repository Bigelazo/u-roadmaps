import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NotificationsProvider,
  useNotificationAcknowledgement,
} from '@/features/notifications/components/NotificationsInbox';

function wrapper({ children }: { children: React.ReactNode }) {
  return <NotificationsProvider identity={{ userId: 'user-id' }}>{children}</NotificationsProvider>;
}
afterEach(() => vi.unstubAllGlobals());

test('a failed Node recognition retries the same opening operation without absorbing later arrivals', async () => {
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
  const input = { roadmapId: 'roadmap-id', nodeId: 'node-id' };
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
  expect(operations[0].input).toEqual({ ...input, operationId, retry: false });
  expect(operations[2].input).toEqual({ ...input, operationId, retry: true });
  expect(operations[1].input).toEqual(operations[3].input);
});
