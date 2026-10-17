import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import { createRoadmapForActor, readRoadmapForParticipant } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ identifier, user }) =>
  NextResponse.json(await readRoadmapForParticipant({ userId: user.id, identifier })),
);

export const POST = courseRoute(async ({ identifier, user, request }) => {
  const created = await createRoadmapForActor(
    user,
    identifier,
    () => parseJsonObject(request),
    roadmapChangePort,
  );
  return NextResponse.json({ roadmap: { id: created.roadmap.id }, ...identifier }, { status: 201 });
});
