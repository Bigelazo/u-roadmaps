import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapNode } from '@/features/roadmap/server';

export const POST = courseRoute(
  async ({ actor, body }) => {
    const node = await createRoadmapNode({ ...actor, input: body }, roadmapChangePort);
    return NextResponse.json({ node }, { status: 201 });
  },
  { body: true },
);
