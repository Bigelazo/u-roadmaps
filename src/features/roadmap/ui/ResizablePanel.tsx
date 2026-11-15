'use client';

import { useEffect, useState } from 'react';

export const panelWidthLimits = { min: 320, max: 560 } as const;

type PanelWidthOptions = {
  storageKey: string;
  initialWidth: number;
};

function clampPanelWidth(value: number) {
  const { min, max } = panelWidthLimits;
  return Math.min(max, Math.max(min, value));
}

function storedPanelWidth(storageKey: string, initialWidth: number) {
  try {
    const storedValue = window.localStorage?.getItem(storageKey);
    if (storedValue === null || storedValue === undefined) return initialWidth;
    const value = Number(storedValue);
    return Number.isFinite(value) ? clampPanelWidth(value) : initialWidth;
  } catch {
    return initialWidth;
  }
}

export function usePersistentPanelWidth({ storageKey, initialWidth }: PanelWidthOptions) {
  const [width, setWidth] = useState(initialWidth);

  useEffect(() => {
    setWidth(storedPanelWidth(storageKey, initialWidth));
  }, [initialWidth, storageKey]);

  return {
    width,
    setWidth: (value: number) => {
      const nextWidth = clampPanelWidth(value);
      setWidth(nextWidth);
      try {
        window.localStorage?.setItem(storageKey, String(nextWidth));
      } catch {
        return;
      }
    },
  };
}
