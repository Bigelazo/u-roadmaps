import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapNodeType, getNodeTypesForActor } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ actor }) => {
  const nodeTypes = await getNodeTypesForActor(actor);
  return NextResponse.json({ nodeTypes });
});

export const POST = courseRoute(
  async ({ actor, body }) => {
    const nodeType = await createRoadmapNodeType({ ...actor, input: body }, roadmapChangePort);
    return NextResponse.json({ nodeType }, { status: 201 });
  },
  { body: true },
);
