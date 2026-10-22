import {
  POSITION_PRIORITY,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

export function completionRatio(completedVisibleNodes: number, visibleNodes: number) {
  if (visibleNodes === 0) return null;
  return Math.min(completedVisibleNodes, visibleNodes) / visibleNodes;
}

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
