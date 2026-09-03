import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

/** Builds the stable public URL for a Roadmap API resource. */
export function roadmapUrl(identifier: CourseOfferingIdentifier, suffix = ''): string {
  return `/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap${suffix}`;
}
