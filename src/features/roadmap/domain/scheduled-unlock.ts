import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import {
  eligibleBranchUnlockNodeIds,
  transitivePrerequisiteNodeIds,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';

export type CalendarDay = string;

type ScheduledUnlockNode = {
  id: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  teacherUnlockOn: CalendarDay | null;
  teacherUnlockIncludesDependents: boolean;
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
  | { kind: 'ALLOWED'; day: CalendarDay | null; includesDependents: boolean }
  | RuleRejection<ScheduledUnlockRuleFailure>;

export function decideScheduledUnlockDay({
  unlockOn,
  includeDependents,
  today,
}: {
  unlockOn: unknown;
  includeDependents?: unknown;
  today: CalendarDay;
}): ScheduledUnlockDecision {
  if (unlockOn === null) return { kind: 'ALLOWED', day: null, includesDependents: false };
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
  return { kind: 'ALLOWED', day: unlockOn, includesDependents: includeDependents === true };
}

export function decideScheduledUnlock({
  node,
  unlockOn,
  includeDependents,
  today,
}: {
  node: { isVisible: boolean; isTeacherBlocked: boolean };
  unlockOn: unknown;
  includeDependents?: unknown;
  today: CalendarDay;
}): ScheduledUnlockDecision {
  const day = decideScheduledUnlockDay({ unlockOn, includeDependents, today });
  if (day.kind === 'REJECTED' || day.day === null) return day;
  if (!node.isVisible || !node.isTeacherBlocked)
    return ruleRejection(
      'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
      'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
    );
  return day;
}

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
  const retainedNodeIds = pendingScheduledUnlockNodeIds({ nodes, today });
  const released = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const { id, teacherUnlockIncludesDependents } of candidates) {
      if (!teacherBlockedNodeIds.has(id)) continue;
      const prerequisites = transitivePrerequisiteNodeIds(dependencies, id);
      if ([...prerequisites].some((prerequisite) => teacherBlockedNodeIds.has(prerequisite))) {
        continue;
      }
      const releasedNodeIds = teacherUnlockIncludesDependents
        ? eligibleBranchUnlockNodeIds({
            dependencies,
            teacherBlockedNodeIds,
            rootNodeId: id,
            retainedNodeIds,
          })
        : [id];
      for (const releasedNodeId of releasedNodeIds) {
        teacherBlockedNodeIds.delete(releasedNodeId);
        released.add(releasedNodeId);
      }
      changed = true;
    }
  }
  return released;
}

export function pendingScheduledUnlockNodeIds({
  nodes,
  today,
}: {
  nodes: readonly Omit<ScheduledUnlockNode, 'teacherUnlockIncludesDependents'>[];
  today: CalendarDay;
}) {
  return new Set(
    nodes
      .filter(
        (node) =>
          node.isVisible &&
          node.isTeacherBlocked &&
          node.teacherUnlockOn !== null &&
          node.teacherUnlockOn > today,
      )
      .map(({ id }) => id),
  );
}
