'use client';

import { useSyncExternalStore } from 'react';

export const compactCanvasLayoutQuery = '(max-width: 1023px)';

const coarsePointerQuery = '(pointer: coarse)';

function subscribeTo(query: string) {
  return (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  };
}

const subscribeToCompactLayout = subscribeTo(compactCanvasLayoutQuery);
const subscribeToCoarsePointer = subscribeTo(coarsePointerQuery);

export function useCompactCanvasLayout() {
  return useSyncExternalStore(
    subscribeToCompactLayout,
    () => window.matchMedia(compactCanvasLayoutQuery).matches,
    () => false,
  );
}

export function useCoarsePointer() {
  return useSyncExternalStore(
    subscribeToCoarsePointer,
    () => window.matchMedia(coarsePointerQuery).matches,
    () => false,
  );
}
