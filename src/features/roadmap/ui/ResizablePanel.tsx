'use client';

import { useEffect, useRef, useState } from 'react';

export const panelWidthLimits = { min: 320, max: 560 } as const;

type PanelWidthOptions = {
  storageKey: string;
  initialWidth: number;
  limits?: typeof panelWidthLimits;
};

function clampPanelWidth(value: number, { min, max }: typeof panelWidthLimits) {
  return Math.min(max, Math.max(min, value));
}

function storedPanelWidth(
  storageKey: string,
  initialWidth: number,
  limits: typeof panelWidthLimits,
) {
  try {
    const storedValue = window.localStorage?.getItem(storageKey);
    if (storedValue === null || storedValue === undefined) return initialWidth;
    const value = Number(storedValue);
    return Number.isFinite(value) ? clampPanelWidth(value, limits) : initialWidth;
  } catch {
    return initialWidth;
  }
}

export function usePersistentPanelWidth({
  storageKey,
  initialWidth,
  limits = panelWidthLimits,
}: PanelWidthOptions) {
  const [width, setWidth] = useState(initialWidth);
  const hasRestoredWidth = useRef(false);

  useEffect(() => {
    setWidth(storedPanelWidth(storageKey, initialWidth, limits));
  }, [initialWidth, limits, storageKey]);

  useEffect(() => {
    if (!hasRestoredWidth.current) {
      hasRestoredWidth.current = true;
      return;
    }
    try {
      window.localStorage?.setItem(storageKey, String(width));
    } catch {
      // Browser privacy settings can make storage unavailable; resizing still works for this visit.
    }
  }, [storageKey, width]);

  return { width, setWidth: (value: number) => setWidth(clampPanelWidth(value, limits)) };
}
