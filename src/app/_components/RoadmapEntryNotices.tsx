'use client';

import type { ReactNode } from 'react';
import { RoadmapEntryNotifications } from '@/features/notifications';
import { NodeName } from '@/features/roadmap';

export function RoadmapEntryNotices({ children }: { children: ReactNode }) {
  return <RoadmapEntryNotifications NodeName={NodeName}>{children}</RoadmapEntryNotifications>;
}
