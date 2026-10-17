import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapNodeType, getNodeTypesForActor } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user }) => {
  const nodeTypes = await getNodeTypesForActor(user, identifier, roadmapChangePort);
  return NextResponse.json({ nodeTypes });
});

export const POST = courseRoute(
  async ({ identifier, user, body }) => {
    const nodeType = await createRoadmapNodeType({ userId: user.id, identifier, input: body });
    return NextResponse.json({ nodeType }, { status: 201 });
  },
  { body: true },
);
