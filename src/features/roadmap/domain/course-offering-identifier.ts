import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export type CourseOfferingIdentifierParams = Readonly<{
  courseCode: string;
  year: string;
  semester: string;
}>;

export function parseCourseOfferingIdentifier(
  params: CourseOfferingIdentifierParams,
): CourseOfferingIdentifier | null {
  let courseCode: string;
  try {
    courseCode = decodeURIComponent(params.courseCode).trim();
  } catch {
    return null;
  }
  const year = Number(params.year);
  const semester = Number(params.semester);

  if (
    !courseCode ||
    courseCode.length > 20 ||
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(semester) ||
    ![1, 2].includes(semester)
  ) {
    return null;
  }

  return { courseCode, year, semester };
}
