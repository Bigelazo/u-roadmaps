import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export type CourseOfferingIdentifierParams = Readonly<{
  courseCode: string;
  year: string;
  semester: string;
}>;

/** The canonical Course code of a route parameter, or null when it cannot be one. */
export function parseCourseCode(param: string): string | null {
  let courseCode: string;
  try {
    courseCode = decodeURIComponent(param).trim();
  } catch {
    return null;
  }
  return courseCode && courseCode.length <= 20 ? courseCode : null;
}

export function parseCourseOfferingIdentifier(
  params: CourseOfferingIdentifierParams,
): CourseOfferingIdentifier | null {
  const courseCode = parseCourseCode(params.courseCode);
  const year = Number(params.year);
  const semester = Number(params.semester);

  if (
    !courseCode ||
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(semester) ||
    ![1, 2].includes(semester)
  ) {
    return null;
  }

  return { courseCode, year, semester };
}
