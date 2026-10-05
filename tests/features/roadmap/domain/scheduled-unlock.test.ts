import { expect, test } from 'vitest';
import {
  chileCalendarDay,
  dueScheduledUnlockNodeIds,
  requireScheduledUnlockDay,
} from '@/features/roadmap/domain/scheduled-unlock';

const chain = [
  { sourceNodeId: 'intro', targetNodeId: 'theory' },
  { sourceNodeId: 'theory', targetNodeId: 'assessment' },
];

function node(id: string, teacherUnlockOn: string | null, isTeacherBlocked = true) {
  return { id, isVisible: true, isTeacherBlocked, teacherUnlockOn };
}

test('releases a blocked node on its scheduled Chilean day and not before', () => {
  const nodes = [
    node('intro', null, false),
    node('theory', '2026-10-14'),
    node('assessment', null),
  ];

  expect([
    ...dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-13' }),
  ]).toEqual([]);
  expect([
    ...dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-14' }),
  ]).toEqual(['theory']);
  expect([
    ...dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-20' }),
  ]).toEqual(['theory']);
});

test('waits while any transitive prerequisite keeps a teacher block', () => {
  const nodes = [node('intro', null), node('theory', null), node('assessment', '2026-10-14')];

  expect([
    ...dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-20' }),
  ]).toEqual([]);
});

test('releases a due chain together when every blocked prerequisite is also due', () => {
  const nodes = [
    node('intro', '2026-10-10'),
    node('theory', '2026-10-12'),
    node('assessment', '2026-10-14'),
  ];

  expect(
    new Set(dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-14' })),
  ).toEqual(new Set(['intro', 'theory', 'assessment']));
  expect(
    new Set(dueScheduledUnlockNodeIds({ nodes, dependencies: chain, today: '2026-10-12' })),
  ).toEqual(new Set(['intro', 'theory']));
});

test('ignores schedules on nodes without a teacher block', () => {
  const nodes = [node('intro', '2026-10-01', false)];

  expect([...dueScheduledUnlockNodeIds({ nodes, dependencies: [], today: '2026-10-14' })]).toEqual(
    [],
  );
});

test('places the Chilean calendar day across daylight-saving offsets', () => {
  // 02:30 UTC is still the previous day in Chile during summer (UTC-3).
  expect(chileCalendarDay(new Date('2026-12-01T02:30:00Z'))).toBe('2026-11-30');
  expect(chileCalendarDay(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01');
  // During winter (UTC-4) midnight arrives one hour later.
  expect(chileCalendarDay(new Date('2026-07-01T03:30:00Z'))).toBe('2026-06-30');
  expect(chileCalendarDay(new Date('2026-07-01T04:30:00Z'))).toBe('2026-07-01');
});

test('accepts only a future calendar day', () => {
  expect(requireScheduledUnlockDay('2026-10-15', '2026-10-14')).toBe('2026-10-15');
  expect(() => requireScheduledUnlockDay('2026-10-14', '2026-10-14')).toThrow();
  expect(() => requireScheduledUnlockDay('2026-02-30', '2026-01-01')).toThrow();
  expect(() => requireScheduledUnlockDay('15-10-2026', '2026-01-01')).toThrow();
});
