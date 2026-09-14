import { ApplicationError } from '@/shared/errors/types';
import { parseCourseOfferingIdentifier } from '@/features/roadmap/domain/course-offering-identifier';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { CourseOfferingIdentifierParams } from '@/features/roadmap/domain/course-offering-identifier';

export function requireCourseOfferingIdentifier(
  params: CourseOfferingIdentifierParams,
): CourseOfferingIdentifier {
  const identifier = parseCourseOfferingIdentifier(params);
  if (!identifier) {
    throw new ApplicationError(
      400,
      'INVALID_ACADEMIC_IDENTITY',
      'El ramo, año y semestre no forman una identidad académica válida.',
    );
  }
  return identifier;
}
