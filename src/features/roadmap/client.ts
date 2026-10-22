import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

export function roadmapUrl(identifier: CourseOfferingIdentifier, suffix = ''): string {
  return `/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap${suffix}`;
}

export { versionHistoryUrl, versionUrl } from '@/shared/version-history-url';
export { courseParticipantsUrl } from '@/shared/course-offering';
