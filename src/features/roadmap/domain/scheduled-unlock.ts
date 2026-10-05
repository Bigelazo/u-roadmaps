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

export function chileCalendarDay(now = new Date()): CalendarDay {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export class InvalidScheduledUnlockDay extends Error {}

export function requireScheduledUnlockDay(value: unknown, today: CalendarDay): CalendarDay {
  if (!isCalendarDay(value)) {
    throw new InvalidScheduledUnlockDay('La fecha debe tener el formato AAAA-MM-DD.');
  }
  if (value <= today) {
    throw new InvalidScheduledUnlockDay('La fecha de desbloqueo debe ser posterior a hoy.');
  }
  return value;
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
