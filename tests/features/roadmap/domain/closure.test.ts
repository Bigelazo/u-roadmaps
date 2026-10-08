import { expect, test } from 'vitest';
import {
  isPastRoadmapClosure,
  resolveRoadmapFreezeDate,
  roadmapClosureInstant,
} from '@/features/roadmap/domain/closure';

test.each([
  [2026, 1, '2026-07-10', '2026-07-10'],
  [2026, 2, '2026-12-12', '2026-12-12'],
  [2026, 1, null, '2026-07-20'],
  [2026, 2, null, '2027-01-20'],
])('resolves the Roadmap freeze date for %i-%i', (year, semester, synchronizedDate, expected) => {
  expect(resolveRoadmapFreezeDate({ year, semester }, synchronizedDate)).toBe(expected);
});

test.each([
  ['2026-07-20', '2026-07-21T04:00:00.000Z'],
  ['2027-01-20', '2027-01-21T03:00:00.000Z'],
  ['2026-04-04', '2026-04-05T04:00:00.000Z'],
  // Spring skips midnight: the next Chilean day starts at 01:00.
  ['2026-09-05', '2026-09-06T04:00:00.000Z'],
  ['2026-09-06', '2026-09-07T03:00:00.000Z'],
])('closes after the whole freeze day %s, across daylight-saving transitions', (day, expected) => {
  expect(roadmapClosureInstant(day).toISOString()).toBe(expected);
});

test.each([
  ['2026-07-10', '2026-07-11T03:59:59.999Z', false],
  ['2026-07-10', '2026-07-11T04:00:00.000Z', true],
  // Without a synchronized date, the first-semester fallback is 20 July.
  [null, '2026-07-21T03:59:59.999Z', false],
  [null, '2026-07-21T04:00:00.000Z', true],
])(
  'a 2026-1 offering with freeze date %s is past closure at %s: %s',
  (synchronizedDate, now, expected) => {
    expect(isPastRoadmapClosure({ year: 2026, semester: 1 }, synchronizedDate, new Date(now))).toBe(
      expected,
    );
  },
);
