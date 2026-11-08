import { expect, test } from 'vitest';
import {
  chileCalendarDay,
  chileInstant,
  chileWallClock,
  blockedPrerequisiteNodeIds,
  decideScheduledUnlock,
  dueScheduledUnlockNodeIds,
} from '@/features/roadmap/domain/scheduled-unlock';

const chain = [
  { sourceNodeId: 'intro', targetNodeId: 'theory' },
  { sourceNodeId: 'theory', targetNodeId: 'assessment' },
];

function node(
  id: string,
  teacherUnlockAt: string | null,
  isTeacherBlocked = true,
  teacherUnlockIncludesDependents = false,
) {
  return {
    id,
    isVisible: true,
    isTeacherBlocked,
    teacherUnlockAt,
    teacherUnlockIncludesDependents,
  };
}

function due(nodes: ReturnType<typeof node>[], now: string, dependencies = chain) {
  return new Set(dueScheduledUnlockNodeIds({ nodes, dependencies, now: new Date(now) }));
}

const longChain = [
  { sourceNodeId: 'a', targetNodeId: 'b' },
  { sourceNodeId: 'b', targetNodeId: 'c' },
  { sourceNodeId: 'c', targetNodeId: 'd' },
];

test('a Scheduled unlock with dependents releases its branch, stopping at a dependent with its own pending schedule', () => {
  const nodes = [
    node('a', '2026-10-14T12:00:00.000Z', true, true),
    node('b', null),
    node('c', '2026-10-20T12:00:00.000Z'),
    node('d', null),
  ];

  expect(due(nodes, '2026-10-14T12:00:00.000Z', longChain)).toEqual(new Set(['a', 'b']));
});

test('a Scheduled unlock with dependents releases through a dependent whose own schedule is also due', () => {
  const nodes = [
    node('a', '2026-10-14T12:00:00.000Z', true, true),
    node('b', null),
    node('c', '2026-10-14T11:00:00.000Z'),
    node('d', null),
  ];

  expect(due(nodes, '2026-10-14T12:00:00.000Z', longChain)).toEqual(new Set(['a', 'b', 'c', 'd']));
});

test('a Scheduled unlock without dependents releases only its Node', () => {
  const nodes = [
    node('a', '2026-10-14T12:00:00.000Z'),
    node('b', null),
    node('c', null),
    node('d', null),
  ];

  expect(due(nodes, '2026-10-14T12:00:00.000Z', longChain)).toEqual(new Set(['a']));
});

test('releases a blocked node at its scheduled instant and not before', () => {
  const nodes = [
    node('intro', null, false),
    node('theory', '2026-10-14T17:30:00.000Z'),
    node('assessment', null),
  ];

  expect(due(nodes, '2026-10-14T17:29:59.999Z')).toEqual(new Set());
  expect(due(nodes, '2026-10-14T17:30:00.000Z')).toEqual(new Set(['theory']));
  expect(due(nodes, '2026-10-20T00:00:00.000Z')).toEqual(new Set(['theory']));
});

test('waits while any transitive prerequisite keeps a teacher block', () => {
  const nodes = [
    node('intro', null),
    node('theory', null),
    node('assessment', '2026-10-14T12:00:00.000Z'),
  ];

  expect(due(nodes, '2026-10-20T12:00:00.000Z')).toEqual(new Set());
});

test('releases a due chain together when every blocked prerequisite is also due', () => {
  const nodes = [
    node('intro', '2026-10-10T12:00:00.000Z'),
    node('theory', '2026-10-12T12:00:00.000Z'),
    node('assessment', '2026-10-14T12:00:00.000Z'),
  ];

  expect(due(nodes, '2026-10-14T12:00:00.000Z')).toEqual(
    new Set(['intro', 'theory', 'assessment']),
  );
  expect(due(nodes, '2026-10-12T12:00:00.000Z')).toEqual(new Set(['intro', 'theory']));
});

test('ignores schedules on nodes without a teacher block', () => {
  const nodes = [node('intro', '2026-10-01T12:00:00.000Z', false)];

  expect(due(nodes, '2026-10-14T12:00:00.000Z', [])).toEqual(new Set());
});

test('places the Chilean calendar day across daylight-saving offsets', () => {
  expect(chileCalendarDay(new Date('2026-12-01T02:30:00Z'))).toBe('2026-11-30');
  expect(chileCalendarDay(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01');
  expect(chileCalendarDay(new Date('2026-07-01T03:30:00Z'))).toBe('2026-06-30');
  expect(chileCalendarDay(new Date('2026-07-01T04:30:00Z'))).toBe('2026-07-01');
});

test('reads and places a Chilean day and time across daylight-saving offsets', () => {
  expect(chileWallClock(new Date('2026-11-21T17:30:00.000Z'))).toEqual({
    day: '2026-11-21',
    time: '14:30',
  });
  expect(chileWallClock(new Date('2026-07-01T03:15:00.000Z'))).toEqual({
    day: '2026-06-30',
    time: '23:15',
  });
  expect(chileInstant({ day: '2026-11-21', time: '14:30' }).toISOString()).toBe(
    '2026-11-21T17:30:00.000Z',
  );
  expect(chileInstant({ day: '2026-06-30', time: '23:15' }).toISOString()).toBe(
    '2026-07-01T03:15:00.000Z',
  );
});

const blocked = { isVisible: true, isTeacherBlocked: true };
const now = new Date('2026-10-14T15:00:00.000Z');

test('schedules a Teacher-blocked Node only at a future instant, normalized to UTC', () => {
  const invalidInstant = { kind: 'REJECTED', reason: 'INVALID_TEACHER_UNLOCK_DATE' };

  expect(
    decideScheduledUnlock({ node: blocked, unlockAt: '2026-10-14T12:15:00-03:00', now }),
  ).toEqual({
    kind: 'ALLOWED',
    unlockAt: '2026-10-14T15:15:00.000Z',
    includesDependents: false,
  });
  for (const unlockAt of ['2026-10-14T15:00:00.000Z', '2026-10-13T20:00:00.000Z'])
    expect(decideScheduledUnlock({ node: blocked, unlockAt, now })).toMatchObject({
      ...invalidInstant,
      message: 'El desbloqueo programado debe quedar en el futuro.',
    });
  for (const unlockAt of ['2026-10-15', '2026-02-30T10:00:00Z', '2026-10-15T10:00:00', 42])
    expect(decideScheduledUnlock({ node: blocked, unlockAt, now })).toMatchObject({
      ...invalidInstant,
      message: 'La fecha y hora deben incluir su zona horaria (ISO 8601).',
    });
});

test('schedules only a visible Node with a Teacher block', () => {
  const requiresBlock = {
    kind: 'REJECTED',
    reason: 'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
    message: 'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
  };
  const unlockAt = '2026-10-15T12:00:00.000Z';

  expect(
    decideScheduledUnlock({ node: { isVisible: true, isTeacherBlocked: false }, unlockAt, now }),
  ).toEqual(requiresBlock);
  expect(
    decideScheduledUnlock({ node: { isVisible: false, isTeacherBlocked: true }, unlockAt, now }),
  ).toEqual(requiresBlock);
});

test('discards a schedule on any Node', () => {
  expect(
    decideScheduledUnlock({
      node: { isVisible: false, isTeacherBlocked: false },
      unlockAt: null,
      now,
    }),
  ).toEqual({ kind: 'ALLOWED', unlockAt: null, includesDependents: false });
});

test('schedules a Node together with its dependents only when asked to', () => {
  const unlockAt = '2026-10-15T12:00:00.000Z';

  expect(decideScheduledUnlock({ node: blocked, unlockAt, includeDependents: true, now })).toEqual({
    kind: 'ALLOWED',
    unlockAt,
    includesDependents: true,
  });
  expect(
    decideScheduledUnlock({ node: blocked, unlockAt: null, includeDependents: true, now }),
  ).toEqual({ kind: 'ALLOWED', unlockAt: null, includesDependents: false });
});

test('finds every Teacher-blocked transitive prerequisite a Scheduled unlock also schedules', () => {
  const nodes = [
    node('a', null),
    node('b', null, false),
    node('c', null),
    node('d', null),
    node('e', null),
  ];
  const dependencies = [...longChain, { sourceNodeId: 'd', targetNodeId: 'e' }];

  expect(blockedPrerequisiteNodeIds({ nodes, dependencies, nodeId: 'd' })).toEqual(['a', 'c']);
  expect(blockedPrerequisiteNodeIds({ nodes, dependencies, nodeId: 'a' })).toEqual([]);
});
