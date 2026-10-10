'use client';

import { useEffect, useRef } from 'react';

function post(path: string, body: Record<string, string>) {
  // A lost record only means the invitation may show once more: never block the page.
  void fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** Runs `record` once, the first time `when` holds. */
function useOnce(when: boolean, record: () => void) {
  const recorded = useRef(false);
  useEffect(() => {
    if (!when || recorded.current) return;
    recorded.current = true;
    record();
  });
}

// Shared code may not import feature types, so these mirror the roadmap feature's
// TutorialInvitation and PracticeExperience; the routes validate them.
type TutorialInvitation = 'first-visit' | 'post-creation';
type PracticeExperience = 'student' | 'teaching';

/** Claims a tutorial invitation once its dialog shows, so it never shows again. */
export function useClaimTutorialInvitation(invitation: TutorialInvitation, shown: boolean) {
  useOnce(shown, () => post('/api/tutorial/invitations', { invitation }));
}

/** Records, on mount, that the User opened a Roadmap tutorial on the Practice roadmap. */
export function useRecordTutorialOpening(experience: PracticeExperience) {
  useOnce(true, () => post('/api/tutorial/openings', { experience }));
}
