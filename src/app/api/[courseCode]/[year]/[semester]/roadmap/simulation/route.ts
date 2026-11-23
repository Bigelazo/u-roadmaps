import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { readSimulatedRoadmap, resetSimulatedCompletions } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ actor }) =>
  NextResponse.json(await readSimulatedRoadmap(actor)),
);

export const DELETE = courseRoute(async ({ actor }) => {
  const result = await resetSimulatedCompletions(actor, roadmapChangePort);
  return NextResponse.json({ deletedCount: result.count });
});
