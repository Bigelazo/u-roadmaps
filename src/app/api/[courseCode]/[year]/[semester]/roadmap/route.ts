import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import { createRoadmapForActor, readRoadmapForParticipant } from '@/features/roadmap/server';

export const GET = courseRoute(async ({ actor }) =>
  NextResponse.json(await readRoadmapForParticipant(actor)),
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
