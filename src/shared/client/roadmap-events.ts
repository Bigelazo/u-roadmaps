type CourseOfferingIdentifier = { courseCode: string; year: number; semester: number };

/** Authorized Roadmap invalidations received through the application SSE connection. */
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

export const ROADMAP_RECOVERY_EVENT = 'u-roadmaps:roadmap-recovery';

export function requestRoadmapRecovery() {
  window.dispatchEvent(new Event(ROADMAP_RECOVERY_EVENT));
}

/** Event-driven recovery, with no polling or recognition of notices. */
export function subscribeToRoadmapRecovery(listener: () => void) {
  const foreground = () => {
    if (document.visibilityState === 'visible') listener();
  };
  window.addEventListener('online', listener);
  window.addEventListener('focus', foreground);
  document.addEventListener('visibilitychange', foreground);
  window.addEventListener(ROADMAP_RECOVERY_EVENT, listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('focus', foreground);
    document.removeEventListener('visibilitychange', foreground);
    window.removeEventListener(ROADMAP_RECOVERY_EVENT, listener);
  };
}
