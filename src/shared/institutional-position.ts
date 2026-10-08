/** Effective U-Campus position, ordered by the domain's permission precedence. */
export const POSITION_PRIORITY = [
  'COURSE_PROFESSOR',
  'COORDINATING_PROFESSOR',
  'AUXILIARY_PROFESSOR',
  'TEACHING_ASSISTANT',
  'STUDENT',
  'OBSERVER',
] as const;

export type InstitutionalCoursePosition = (typeof POSITION_PRIORITY)[number];

export function effectivePosition(positions: readonly InstitutionalCoursePosition[]) {
  return POSITION_PRIORITY.find((position) => positions.includes(position)) ?? null;
}

export function positionCapabilities(position: InstitutionalCoursePosition | null) {
  const isTeachingStaff = position !== null && POSITION_PRIORITY.indexOf(position) < 4;
  return {
    isTeachingStaff,
    canEdit: isTeachingStaff,
    canCreateRoadmap: position === 'COURSE_PROFESSOR',
    role: isTeachingStaff ? ('TEACHER' as const) : ('STUDENT' as const),
  };
}
