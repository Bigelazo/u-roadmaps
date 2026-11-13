'use client';

import { CachedAcademicOverview } from '@/features/academic-overview';
import { CreateRoadmapDialog } from '@/features/roadmap';

export function AcademicOverviewClient(
  props: Omit<React.ComponentProps<typeof CachedAcademicOverview>, 'renderRoadmapCreation'>,
) {
  return (
    <CachedAcademicOverview
      {...props}
      renderRoadmapCreation={(course) => <CreateRoadmapDialog {...course} />}
    />
  );
}
