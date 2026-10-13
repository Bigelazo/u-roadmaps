import {
  POSITION_PRIORITY,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

/**
 * A participant's share of the Roadmap's visible Nodes they have completed, from
 * 0 to 1. Hidden Nodes are outside the measure; a retained Completion of a Node
 * that is currently blocked still counts. Null when the Roadmap has no visible Node.
 */
export function completionRatio(completedVisibleNodes: number, visibleNodes: number) {
  if (visibleNodes === 0) return null;
  return Math.min(completedVisibleNodes, visibleNodes) / visibleNodes;
}

/**
 * The mean completion of the Course offering's students. Observers and teaching
 * staff are not academically evaluated, so they never weigh on it; a student who
 * has never entered the platform counts with no Completions.
 */
export function averageStudentCompletion(
  members: readonly Readonly<{
    institutionalPosition: InstitutionalCoursePosition | null;
    completion: number | null;
  }>[],
) {
  const ratios = members.flatMap(({ institutionalPosition, completion }) =>
    institutionalPosition === 'STUDENT' && completion !== null ? [completion] : [],
  );
  if (ratios.length === 0) return null;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

/** Position precedence, unknown positions last, then name. */
export function compareCourseMembers(
  a: { name: string; institutionalPosition: InstitutionalCoursePosition | null },
  b: { name: string; institutionalPosition: InstitutionalCoursePosition | null },
) {
  const rank = (position: InstitutionalCoursePosition | null) =>
    position ? POSITION_PRIORITY.indexOf(position) : POSITION_PRIORITY.length;
  return (
    rank(a.institutionalPosition) - rank(b.institutionalPosition) ||
    a.name.localeCompare(b.name, 'es-CL')
  );
}
