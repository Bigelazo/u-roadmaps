import {
  POSITION_PRIORITY,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

export type AcademicTermKey = Readonly<{ year: number; semester: number }>;

function compareTerms(a: AcademicTermKey, b: AcademicTermKey) {
  return a.year - b.year || a.semester - b.semester;
}

/** Latest Academic term in which the person holds an active teaching-staff Participation. */
export function versionHistoryHorizon(
  participations: readonly (AcademicTermKey & {
    role: 'STUDENT' | 'TEACHER';
    isActive: boolean;
  })[],
): AcademicTermKey | null {
  let horizon: AcademicTermKey | null = null;
  for (const { year, semester, role, isActive } of participations) {
    if (role !== 'TEACHER' || !isActive) continue;
    if (!horizon || compareTerms({ year, semester }, horizon) > 0) horizon = { year, semester };
  }
  return horizon;
}

export function isWithinVersionHorizon(term: AcademicTermKey, horizon: AcademicTermKey) {
  return compareTerms(term, horizon) <= 0;
}

/** Newest edition first. */
export function compareEditionsNewestFirst(a: AcademicTermKey, b: AcademicTermKey) {
  return compareTerms(b, a);
}

/** Recorded staff by position precedence, then by name. */
export function compareRecordedStaff(
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

export function editionLabel({ year, semester }: AcademicTermKey) {
  return `Edición ${year}-${semester}`;
}
