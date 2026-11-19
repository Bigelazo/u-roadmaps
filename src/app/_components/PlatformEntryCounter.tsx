'use client';

import { useEffect } from 'react';
import { countPlatformEntry } from './platform-entry';

export function PlatformEntryCounter() {
  useEffect(countPlatformEntry, []);
  return null;
}
