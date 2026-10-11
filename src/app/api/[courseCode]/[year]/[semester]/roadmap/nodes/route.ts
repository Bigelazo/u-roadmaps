import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapNode, getRoadmapNodesForActor } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const POST = courseRoute(
  async ({ identifier, user, body }) => {
    const node = await unwrap(() =>
      createRoadmapNode({ userId: user.id, identifier, input: body }, roadmapChangePort),
    );
    return NextResponse.json({ node }, { status: 201 });
  },
  { body: true },
);

export const GET = courseRoute(async ({ identifier, user }) => {
  const nodes = await unwrap(() => getRoadmapNodesForActor(user, identifier, roadmapChangePort));
  return NextResponse.json({ nodes });
});
