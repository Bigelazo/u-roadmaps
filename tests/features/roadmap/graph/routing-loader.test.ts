import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AvoidLib } from 'libavoid-js';

vi.mock('libavoid-js', () => ({ AvoidLib: { load: vi.fn(), getInstance: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('bounds a stalled engine load while allowing slow networks, then shares a fresh retry', async () => {
  vi.mocked(AvoidLib.load).mockReturnValue(new Promise(() => {}));
  const { loadRoutingModule } = await import('@/features/roadmap/graph/routing/libavoid');
  let failure: unknown;
  const stalled = loadRoutingModule();
  void stalled.catch((error: unknown) => {
    failure = error;
  });
  expect(loadRoutingModule()).toBe(stalled);
  await vi.advanceTimersByTimeAsync(17_000);
  expect(failure).toBeUndefined();
  await vi.advanceTimersByTimeAsync(13_000);
  expect(failure).toMatchObject({ name: 'TimeoutError' });
  const loadedModule = {} as ReturnType<typeof AvoidLib.getInstance>;
  vi.mocked(AvoidLib.load).mockResolvedValue(undefined);
  vi.mocked(AvoidLib.getInstance).mockReturnValue(loadedModule);
  const retry = loadRoutingModule();
  expect(retry).not.toBe(stalled);
  expect(loadRoutingModule()).toBe(retry);
  await expect(retry).resolves.toBe(loadedModule);
  expect(AvoidLib.load).toHaveBeenCalledTimes(2);
  expect(loadRoutingModule()).toBe(retry);
});

test.each(['resolve', 'reject'] as const)(
  'a late %s from an expired request cannot replace a pending retry',
  async (outcome) => {
    let resolveExpired!: () => void;
    let rejectExpired!: (error: Error) => void;
    const expired = new Promise<void>((resolve, reject) => {
      resolveExpired = resolve;
      rejectExpired = reject;
    });
    let resolveRetry!: () => void;
    const pendingRetry = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    vi.mocked(AvoidLib.load).mockReturnValueOnce(expired).mockReturnValueOnce(pendingRetry);
    const { loadRoutingModule } = await import('@/features/roadmap/graph/routing/libavoid');
    const first = loadRoutingModule();
    const failed = first.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await failed).toMatchObject({ name: 'TimeoutError' });
    const retry = loadRoutingModule();
    await vi.advanceTimersByTimeAsync(0);
    if (outcome === 'resolve') resolveExpired();
    else rejectExpired(new Error('Expired request failed late'));
    await vi.advanceTimersByTimeAsync(0);
    expect(loadRoutingModule()).toBe(retry);
    const loadedModule = {} as ReturnType<typeof AvoidLib.getInstance>;
    vi.mocked(AvoidLib.getInstance).mockReturnValue(loadedModule);
    resolveRetry();
    await expect(retry).resolves.toBe(loadedModule);
    expect(loadRoutingModule()).toBe(retry);
    expect(AvoidLib.load).toHaveBeenCalledTimes(2);
  },
);
