import type { CourseOfferingIdentifier } from '@/features/roadmap/types';

/** Client-side seam for a Novu `notifications.notification_received` adapter. */
export const ROADMAP_CHANGE_RECEIVED_EVENT = 'u-roadmaps:roadmap-change-received';

export function subscribeToRoadmapChanges(
  listener: (identifier: CourseOfferingIdentifier) => void,
) {
  const onEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const value: unknown = event.detail;
    if (typeof value !== 'object' || value === null) return;
    if (!('courseCode' in value) || typeof value.courseCode !== 'string') return;
    if (!('year' in value) || typeof value.year !== 'number') return;
    if (!('semester' in value) || typeof value.semester !== 'number') return;
    listener({ courseCode: value.courseCode, year: value.year, semester: value.semester });
  };

  window.addEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, onEvent);
  return () => window.removeEventListener(ROADMAP_CHANGE_RECEIVED_EVENT, onEvent);
}
