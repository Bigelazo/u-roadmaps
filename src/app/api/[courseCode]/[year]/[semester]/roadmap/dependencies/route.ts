import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { changeImpactVersion } from '@/app/_adapters/roadmap';
import { createRoadmapDependency, deleteRoadmapDependencies } from '@/features/roadmap/server';

export const POST = courseRoute(
  async ({ actor, body, request }) => {
    const input = {
      ...actor,
      input: body,
      changeImpactVersion: changeImpactVersion(request),
    };
    const result = await createRoadmapDependency(input, roadmapChangePort);
    return NextResponse.json(result, { status: 201 });
  },
  { body: true },
);

export const DELETE = courseRoute(
  async ({ actor, body }) => {
    await deleteRoadmapDependencies({ ...actor, input: body }, roadmapChangePort);
    return new NextResponse(null, { status: 204 });
  },
  { body: true },
);
