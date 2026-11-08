'use client';

import { useState } from 'react';
import type { ConfirmationInput } from '@/features/roadmap/canvas/commands/commands';
import type { UnlockScheduleDraft } from '@/features/roadmap/ui/roadmap-confirmation';

type UnlockScheduleState = {
  readonly request: object | undefined;
  readonly isScheduling: boolean;
  readonly unlockAt: Date | null;
};

export function useUnlockSchedule(request: object | undefined): {
  draft: UnlockScheduleDraft;
  input: ConfirmationInput | undefined;
} {
  const [state, setState] = useState<UnlockScheduleState>({
    request: undefined,
    isScheduling: false,
    unlockAt: null,
  });
  const current =
    state.request === request ? state : { request, isScheduling: false, unlockAt: null };

  return {
    draft: {
      isScheduling: current.isScheduling,
      unlockAt: current.unlockAt,
      onSchedulingChange: (isScheduling) => setState({ ...current, isScheduling }),
      onUnlockAtChange: (unlockAt) => setState({ ...current, isScheduling: true, unlockAt }),
    },
    input:
      current.isScheduling && current.unlockAt
        ? { unlockAt: current.unlockAt.toISOString() }
        : undefined,
  };
}
