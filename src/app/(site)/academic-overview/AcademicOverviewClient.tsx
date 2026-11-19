'use client';

import { CachedAcademicOverview } from '@/features/academic-overview';
import { CreateRoadmapDialog } from '@/features/roadmap';
import { ExtensionInstallPrompt } from '@/app/_components/ExtensionInstallPrompt';

export function AcademicOverviewClient(
  props: Omit<React.ComponentProps<typeof CachedAcademicOverview>, 'renderRoadmapCreation'>,
) {
  return (
    <>
      <CachedAcademicOverview
        {...props}
        renderRoadmapCreation={(course) => <CreateRoadmapDialog {...course} />}
      />
      <ExtensionInstallPrompt suppressed={Boolean(props.tutorialInvitation)} />
    </>
  );
}
