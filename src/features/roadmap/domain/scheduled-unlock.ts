import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import {
  transitivePrerequisiteNodeIds,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';

/** An ISO calendar day (`YYYY-MM-DD`) in the America/Santiago time zone. */
export type CalendarDay = string;

type ScheduledUnlockNode = {
  id: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  teacherUnlockOn: CalendarDay | null;
};

const chileCalendarDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function chileCalendarDay(now = new Date()): CalendarDay {
  return chileCalendarDayFormatter.format(now);
}

export function addCalendarDays(day: CalendarDay, days: number): CalendarDay {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type ScheduledUnlockRuleFailure =
  'INVALID_TEACHER_UNLOCK_DATE' | 'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK';

export type ScheduledUnlockDecision =
  { kind: 'ALLOWED'; day: CalendarDay | null } | RuleRejection<ScheduledUnlockRuleFailure>;

/**
 * Whether `unlockOn` can become the Node's Scheduled unlock: a calendar day after `today`
 * for a visible Node with a Teacher block. `null` discards the schedule.
 */
export function decideScheduledUnlock({
  node,
  unlockOn,
  today,
}: {
  node: { isVisible: boolean; isTeacherBlocked: boolean };
  unlockOn: unknown;
  today: CalendarDay;
}): ScheduledUnlockDecision {
  if (unlockOn === null) return { kind: 'ALLOWED', day: null };
  if (!isCalendarDay(unlockOn))
    return ruleRejection(
      'INVALID_TEACHER_UNLOCK_DATE',
      'La fecha debe tener el formato AAAA-MM-DD.',
    );
  if (unlockOn <= today)
    return ruleRejection(
      'INVALID_TEACHER_UNLOCK_DATE',
      'La fecha de desbloqueo debe ser posterior a hoy.',
    );
  if (!node.isVisible || !node.isTeacherBlocked)
    return ruleRejection(
      'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
      'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
    );
  return { kind: 'ALLOWED', day: unlockOn };
}

/**
 * Scheduled Teacher blocks whose day has arrived and whose transitive prerequisites
 * are free of Teacher blocks, counting prerequisites released by this same pass.
 */
export function dueScheduledUnlockNodeIds({
  nodes,
  dependencies,
  today,
}: {
  nodes: readonly ScheduledUnlockNode[];
  dependencies: readonly RoadmapGraphDependency[];
  today: CalendarDay;
}) {
  const teacherBlockedNodeIds = new Set(
    nodes.filter((node) => node.isTeacherBlocked).map((node) => node.id),
  );
  const candidates = nodes.filter(
    (node) =>
      node.isVisible &&
      node.isTeacherBlocked &&
      node.teacherUnlockOn !== null &&
      node.teacherUnlockOn <= today,
  );
  const released = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const { id } of candidates) {
      if (released.has(id)) continue;
      const prerequisites = transitivePrerequisiteNodeIds(dependencies, id);
      if ([...prerequisites].some((prerequisite) => teacherBlockedNodeIds.has(prerequisite))) {
        continue;
      }
      teacherBlockedNodeIds.delete(id);
      released.add(id);
      changed = true;
    }
  }
  return released;
}
