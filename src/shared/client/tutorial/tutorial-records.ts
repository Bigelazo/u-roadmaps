'use client';

import { useEffect, useRef } from 'react';

function post(path: string, body: Record<string, string>) {
  void fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function useOnce(when: boolean, record: () => void) {
  const recorded = useRef(false);
  useEffect(() => {
    if (!when || recorded.current) return;
    recorded.current = true;
    record();
  });
}

type TutorialInvitation = 'first-visit' | 'post-creation';
type PracticeExperience = 'student' | 'teaching';

export function useClaimTutorialInvitation(invitation: TutorialInvitation, shown: boolean) {
  useOnce(shown, () => post('/api/tutorial/invitations', { invitation }));
}

export function useRecordTutorialOpening(experience: PracticeExperience) {
  useOnce(true, () => post('/api/tutorial/openings', { experience }));
}
