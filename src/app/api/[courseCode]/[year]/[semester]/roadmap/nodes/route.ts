import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapNode } from '@/features/roadmap/server';

export const POST = courseRoute(
  async ({ identifier, user, body }) => {
    const node = await createRoadmapNode(
      { userId: user.id, identifier, input: body },
      roadmapChangePort,
    );
    return NextResponse.json({ node }, { status: 201 });
  },
  { body: true },
);
