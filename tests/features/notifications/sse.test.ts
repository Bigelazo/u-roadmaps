// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { subscribeToPostgresSignals } from '@/features/notifications/infrastructure/postgres-signals';
import { openNotificationStream } from '@/features/notifications/infrastructure/sse';
import {
  NOTIFICATION_STREAM_LIFETIME_MS,
  NOTIFICATION_STREAM_ROTATION_LEAD_MS,
} from '@/features/notifications/contracts/notification-stream';

vi.mock('@/shared/server/db', () => ({ prisma: {} }));
vi.mock('@/features/notifications/infrastructure/postgres-signals', () => ({
  subscribeToPostgresSignals: vi.fn(),
}));

const subscribe = vi.mocked(subscribeToPostgresSignals);
afterEach(() => vi.resetAllMocks());

test.each(['before', 'during'] as const)(
  'closing the request %s subscription completes closes SSE without an error',
  async (timing) => {
    const abort = new AbortController();
    const unsubscribe = vi.fn();
    const subscription = Promise.withResolvers<() => void>();
    subscribe.mockReturnValueOnce(subscription.promise);
    if (timing === 'before') abort.abort();
    const opening = openNotificationStream('user-id', abort.signal);
    if (timing === 'during') abort.abort();
    subscription.resolve(unsubscribe);

    const response = await opening;
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(await response.text()).toBe('');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  },
);

test('a subscription disconnected during setup returns a closed SSE response', async () => {
  const unsubscribe = vi.fn();
  subscribe.mockImplementationOnce(async ({ disconnected }) => {
    disconnected();
    return unsubscribe;
  });

  const response = await openNotificationStream('user-id', new AbortController().signal);
  expect(await response.text()).toBe('');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test.each(['abort', 'cancel', 'disconnect'] as const)(
  '%s after setup releases the subscription exactly once',
  async (reason) => {
    const abort = new AbortController();
    const unsubscribe = vi.fn();
    let disconnect!: () => void;
    subscribe.mockImplementationOnce(async ({ disconnected }) => {
      disconnect = disconnected;
      return unsubscribe;
    });
    const response = await openNotificationStream('user-id', abort.signal);
    const reader = response.body!.getReader();
    try {
      const ready = await reader.read();
      expect(new TextDecoder().decode(ready.value)).toContain('event: ready');
      if (reason === 'abort') abort.abort();
      else if (reason === 'cancel') await reader.cancel();
      else disconnect();
      expect(await reader.read()).toEqual({ done: true, value: undefined });
      abort.abort();
      disconnect();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      abort.abort();
      await reader.cancel();
    }
  },
);

test('a subscription setup failure still propagates the original error', async () => {
  const error = new Error('LISTEN failed');
  subscribe.mockRejectedValueOnce(error);
  await expect(openNotificationStream('user-id', new AbortController().signal)).rejects.toBe(error);
});

test('an open stream asks the browser to rotate before the server closes it', async () => {
  vi.useFakeTimers();
  try {
    subscribe.mockResolvedValueOnce(vi.fn());
    const response = await openNotificationStream('user-id', new AbortController().signal);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const frames: string[] = [];
    const reading = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        frames.push(decoder.decode(value));
      }
    })();
    await vi.advanceTimersByTimeAsync(
      NOTIFICATION_STREAM_LIFETIME_MS - NOTIFICATION_STREAM_ROTATION_LEAD_MS - 1,
    );
    expect(frames.join('')).not.toContain('event: rotate');
    await vi.advanceTimersByTimeAsync(1);
    expect(frames.join('')).toContain('event: rotate\ndata: {"userId":"user-id"}');
    await vi.advanceTimersByTimeAsync(NOTIFICATION_STREAM_ROTATION_LEAD_MS);
    await reading;
  } finally {
    vi.useRealTimers();
  }
});
