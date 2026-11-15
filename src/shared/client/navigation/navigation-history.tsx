'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const previousPathKey = 'u-roadmaps:previous-path';
const currentPathKey = 'u-roadmaps:current-path';

function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    // eslint-disable-next-line no-empty -- Without storage the back control falls back to its default destination.
  } catch {}
}

export function NavigationHistory() {
  const pathname = usePathname();
  useEffect(() => {
    const current = readSession(currentPathKey);
    if (current === pathname) return;
    if (current) writeSession(previousPathKey, current);
    writeSession(currentPathKey, pathname);
  }, [pathname]);
  return null;
}

export function usePreviousPath() {
  const pathname = usePathname();
  const [previous, setPrevious] = useState<string | null>(null);
  useEffect(() => {
    const current = readSession(currentPathKey);
    const recorded = current === pathname ? readSession(previousPathKey) : current;
    setPrevious(recorded && recorded !== pathname ? recorded : null);
  }, [pathname]);
  return previous;
}
