import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import {
  eligibleBranchUnlockNodeIds,
  transitivePrerequisiteNodeIds,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';
import {
  END_OF_DAY_TIME,
  zonedInstant,
  zonedWallClock,
  type ZonedWallClock,
} from '@/shared/zoned-time';

export type CalendarDay = string;

export type UnlockInstant = string;

export const CHILE_TIME_ZONE = 'America/Santiago';

export const SCHEDULED_UNLOCK_DEFAULT_TIME = END_OF_DAY_TIME;

type ScheduledUnlockNode = {
  id: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  teacherUnlockAt: UnlockInstant | null;
  teacherUnlockIncludesDependents: boolean;
};

const chileCalendarDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHILE_TIME_ZONE,
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

export function chileWallClock(instant: Date): ZonedWallClock {
  return zonedWallClock(instant, CHILE_TIME_ZONE);
}

export function chileInstant(wallClock: ZonedWallClock): Date {
  return zonedInstant(wallClock, CHILE_TIME_ZONE);
}

const unlockInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function parseUnlockInstant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = unlockInstantPattern.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const calendarDay = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    Number.isNaN(calendarDay.getTime()) ||
    calendarDay.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  )
    return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function isDue(teacherUnlockAt: UnlockInstant | null, now: Date) {
  return teacherUnlockAt !== null && Date.parse(teacherUnlockAt) <= now.getTime();
}

export type ScheduledUnlockRuleFailure =
  'INVALID_TEACHER_UNLOCK_DATE' | 'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK';

export type ScheduledUnlockDecision =
  | { kind: 'ALLOWED'; unlockAt: UnlockInstant | null; includesDependents: boolean }
  | RuleRejection<ScheduledUnlockRuleFailure>;

export function decideScheduledUnlockInstant({
  unlockAt,
  includeDependents,
  now,
}: {
  unlockAt: unknown;
  includeDependents?: unknown;
  now: Date;
}): ScheduledUnlockDecision {
  if (unlockAt === null) return { kind: 'ALLOWED', unlockAt: null, includesDependents: false };
  const instant = parseUnlockInstant(unlockAt);
  if (!instant)
    return ruleRejection(
      'INVALID_TEACHER_UNLOCK_DATE',
      'La fecha y hora deben incluir su zona horaria (ISO 8601).',
    );
  if (instant.getTime() <= now.getTime())
    return ruleRejection(
      'INVALID_TEACHER_UNLOCK_DATE',
      'El desbloqueo programado debe quedar en el futuro.',
    );
  return {
    kind: 'ALLOWED',
    unlockAt: instant.toISOString(),
    includesDependents: includeDependents === true,
  };
}

export function decideScheduledUnlock({
  node,
  unlockAt,
  includeDependents,
  now,
}: {
  node: { isVisible: boolean; isTeacherBlocked: boolean };
  unlockAt: unknown;
  includeDependents?: unknown;
  now: Date;
}): ScheduledUnlockDecision {
  const decision = decideScheduledUnlockInstant({ unlockAt, includeDependents, now });
  if (decision.kind === 'REJECTED' || decision.unlockAt === null) return decision;
  if (!node.isVisible || !node.isTeacherBlocked)
    return ruleRejection(
      'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
      'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
    );
  return decision;
}

export function settleDueScheduledUnlocks({
  nodes,
  dependencies,
  now,
}: {
  nodes: readonly ScheduledUnlockNode[];
  dependencies: readonly RoadmapGraphDependency[];
  now: Date;
}) {
  const teacherBlockedNodeIds = new Set(
    nodes.filter((node) => node.isTeacherBlocked).map((node) => node.id),
  );
  const candidates = nodes.filter(
    (node) => node.isVisible && node.isTeacherBlocked && isDue(node.teacherUnlockAt, now),
  );
  const retainedNodeIds = pendingScheduledUnlockNodeIds({ nodes, now });
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
  const discarded = new Set(
    candidates.filter(({ id }) => teacherBlockedNodeIds.has(id)).map(({ id }) => id),
  );
  return { releasedNodeIds: released, discardedNodeIds: discarded };
}

export function pendingScheduledUnlockNodeIds({
  nodes,
  now,
}: {
  nodes: readonly Omit<ScheduledUnlockNode, 'teacherUnlockIncludesDependents'>[];
  now: Date;
}) {
  return new Set(
    nodes
      .filter(
        (node) =>
          node.isVisible &&
          node.isTeacherBlocked &&
          node.teacherUnlockAt !== null &&
          !isDue(node.teacherUnlockAt, now),
      )
      .map(({ id }) => id),
  );
}

export function blockedPrerequisiteNodeIds({
  nodes,
  dependencies,
  nodeId,
}: {
  nodes: readonly { id: string; isTeacherBlocked: boolean }[];
  dependencies: readonly RoadmapGraphDependency[];
  nodeId: string;
}) {
  const prerequisiteNodeIds = transitivePrerequisiteNodeIds(dependencies, nodeId);
  return nodes
    .filter(({ id, isTeacherBlocked }) => isTeacherBlocked && prerequisiteNodeIds.has(id))
    .map(({ id }) => id);
}
