'use client';

import dynamic from 'next/dynamic';
import { Suspense, type ComponentProps } from 'react';
import { RoadmapCanvasLoading } from '@/features/roadmap/session/RoadmapCanvasLoading';

const LoadedRoadmapCanvasSession = dynamic(() =>
  import('@/features/roadmap/session/RoadmapCanvasSession').then(
    ({ RoadmapCanvasSession }) => RoadmapCanvasSession,
  ),
);

const LoadedPracticeRoadmapCanvas = dynamic(() =>
  import('@/features/roadmap/practice/PracticeRoadmapCanvas').then(
    ({ PracticeRoadmapCanvas }) => PracticeRoadmapCanvas,
  ),
);

const LoadedRoadmapVersionViewer = dynamic(() =>
  import('@/features/roadmap/ui/RoadmapVersionViewer').then(
    ({ RoadmapVersionViewer }) => RoadmapVersionViewer,
  ),
);

const LoadedRouteSpecimen = dynamic(() =>
  import('@/features/roadmap/ui/RouteSpecimen').then(({ RouteSpecimen }) => RouteSpecimen),
);

export function RoadmapCanvasSession(props: ComponentProps<typeof LoadedRoadmapCanvasSession>) {
  return (
    <Suspense fallback={<RoadmapCanvasLoading />}>
      <LoadedRoadmapCanvasSession {...props} />
    </Suspense>
  );
}

export function PracticeRoadmapCanvas(props: ComponentProps<typeof LoadedPracticeRoadmapCanvas>) {
  return (
    <Suspense fallback={<RoadmapCanvasLoading />}>
      <LoadedPracticeRoadmapCanvas {...props} />
    </Suspense>
  );
}

export function RoadmapVersionViewer(props: ComponentProps<typeof LoadedRoadmapVersionViewer>) {
  return (
    <Suspense fallback={<RoadmapCanvasLoading />}>
      <LoadedRoadmapVersionViewer {...props} />
    </Suspense>
  );
}

export function RouteSpecimen(props: ComponentProps<typeof LoadedRouteSpecimen>) {
  return (
    <Suspense fallback={null}>
      <LoadedRouteSpecimen {...props} />
    </Suspense>
  );
}
