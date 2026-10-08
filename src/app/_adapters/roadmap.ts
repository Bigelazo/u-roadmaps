import { ApplicationError } from '@/shared/errors/types';
import {
  parseCourseCode,
  parseCourseOfferingIdentifier,
  type CourseOfferingIdentifier,
  type CourseOfferingIdentifierParams,
} from '@/features/roadmap';

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

export function requireCourseCode(param: string): string {
  const courseCode = parseCourseCode(param);
  if (!courseCode) {
    throw new ApplicationError(
      400,
      'INVALID_ACADEMIC_IDENTITY',
      'El código del ramo no es válido.',
    );
  }
  return courseCode;
}
