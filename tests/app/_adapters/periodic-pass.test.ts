import { afterEach, expect, test, vi } from 'vitest';
import { delayUntilNextBoundary, startAlignedPass } from '@/app/_adapters/periodic-pass';

const quarterHour = 15 * 60_000;
const margin = 5_000;

afterEach(() => vi.useRealTimers());

test.each([
  ['2026-11-07T16:29:00.000Z', 65_000],
  ['2026-11-07T16:30:00.000Z', 5_000],
  ['2026-11-07T16:30:04.999Z', 1],
  ['2026-11-07T16:30:05.000Z', quarterHour],
  ['2026-11-07T16:30:06.000Z', quarterHour - 1_000],
  ['2026-11-07T16:44:59.000Z', 6_000],
  ['2026-11-07T23:59:00.000Z', 65_000],
])('from %s the next quarter-hour pass is %i ms away', (now, delay) => {
  expect(delayUntilNextBoundary(Date.parse(now), quarterHour, margin)).toBe(delay);
});

test('an aligned pass runs on start and then a margin after every quarter hour', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-11-07T16:22:30.000Z') });
  const runs: string[] = [];
  startAlignedPass({
    run: async () => {
      runs.push(new Date().toISOString());
    },
    periodMs: quarterHour,
    offsetMs: margin,
    onError: () => {},
  });

  await vi.advanceTimersByTimeAsync(31 * 60_000);

  expect(runs).toEqual([
    '2026-11-07T16:22:30.000Z',
    '2026-11-07T16:30:05.000Z',
    '2026-11-07T16:45:05.000Z',
  ]);
});
