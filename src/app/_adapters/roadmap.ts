import { ApplicationError } from '@/shared/errors/types';
import type { CourseOfferingIdentifier } from '@/features/roadmap';

export function parseCourseOfferingIdentifier(params: {
  courseCode: string;
  year: string;
  semester: string;
}): CourseOfferingIdentifier {
  const year = Number(params.year);
  const semester = Number(params.semester);

  if (
    !params.courseCode.trim() ||
    params.courseCode.trim().length > 20 ||
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(semester) ||
    ![1, 2].includes(semester)
  ) {
    throw new ApplicationError(
      400,
      'INVALID_ACADEMIC_IDENTITY',
      'El ramo, año y semestre no forman una identidad académica válida.',
    );
  }

  return { courseCode: params.courseCode.trim(), year, semester };
}
