import { expect, test } from 'vitest';
import {
  chileCalendarDay,
  decideScheduledUnlock,
  dueScheduledUnlockNodeIds,
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
  expect(chileCalendarDay(new Date('2026-12-01T02:30:00Z'))).toBe('2026-11-30');
  expect(chileCalendarDay(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01');
  expect(chileCalendarDay(new Date('2026-07-01T03:30:00Z'))).toBe('2026-06-30');
  expect(chileCalendarDay(new Date('2026-07-01T04:30:00Z'))).toBe('2026-07-01');
});

const blocked = { isVisible: true, isTeacherBlocked: true };

test('schedules a Teacher-blocked Node only on a future calendar day', () => {
  const today = '2026-10-14';
  const invalidDate = { kind: 'REJECTED', reason: 'INVALID_TEACHER_UNLOCK_DATE' };

  expect(decideScheduledUnlock({ node: blocked, unlockOn: '2026-10-15', today })).toEqual({
    kind: 'ALLOWED',
    day: '2026-10-15',
  });
  expect(decideScheduledUnlock({ node: blocked, unlockOn: '2026-10-14', today })).toMatchObject({
    ...invalidDate,
    message: 'La fecha de desbloqueo debe ser posterior a hoy.',
  });
  for (const unlockOn of ['2026-02-30', '15-10-2026'])
    expect(decideScheduledUnlock({ node: blocked, unlockOn, today })).toMatchObject({
      ...invalidDate,
      message: 'La fecha debe tener el formato AAAA-MM-DD.',
    });
});

test('schedules only a visible Node with a Teacher block', () => {
  const requiresBlock = {
    kind: 'REJECTED',
    reason: 'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
    message: 'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
  };
  const today = '2026-10-14';

  expect(
    decideScheduledUnlock({
      node: { isVisible: true, isTeacherBlocked: false },
      unlockOn: '2026-10-15',
      today,
    }),
  ).toEqual(requiresBlock);
  expect(
    decideScheduledUnlock({
      node: { isVisible: false, isTeacherBlocked: true },
      unlockOn: '2026-10-15',
      today,
    }),
  ).toEqual(requiresBlock);
});

test('discards a schedule on any Node', () => {
  expect(
    decideScheduledUnlock({
      node: { isVisible: false, isTeacherBlocked: false },
      unlockOn: null,
      today: '2026-10-14',
    }),
  ).toEqual({ kind: 'ALLOWED', day: null });
});
