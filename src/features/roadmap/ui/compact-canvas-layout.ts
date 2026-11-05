'use client';

import { useSyncExternalStore } from 'react';

/**
 * The Roadmap canvas switches to its compact layout below Tailwind's `lg`
 * breakpoint: the canvas fills the viewport and side content (node detail,
 * node editor, node actions) is presented as sheets instead of a side column.
 * Every compact/wide decision on the Roadmap screen reads this one query.
 */
export const compactCanvasLayoutQuery = '(max-width: 1023px)';

/** Coarse pointers need 44px targets regardless of layout width. */
export const coarsePointerQuery = '(pointer: coarse)';

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
