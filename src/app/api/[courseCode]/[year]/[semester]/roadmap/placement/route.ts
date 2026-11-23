import { NextResponse } from 'next/server';
import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { courseRoute } from '@/app/_adapters/http';
import { saveRoadmapNodePositions } from '@/features/roadmap/server';

export const PATCH = courseRoute(
  async ({ actor, body }) => {
    await saveRoadmapNodePositions({ ...actor, input: body }, roadmapChangePort);
    return new NextResponse(null, { status: 204 });
  },
  { body: true },
);
