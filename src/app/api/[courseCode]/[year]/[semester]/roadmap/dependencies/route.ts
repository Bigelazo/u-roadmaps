import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapDependency, deleteRoadmapDependencies } from '@/features/roadmap/server';

export const POST = courseRoute(
  async ({ identifier, user, body, request }) => {
    const input = {
      userId: user.id,
      identifier,
      input: body,
      previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
    };
    const result = await createRoadmapDependency(input, roadmapChangePort);
    return NextResponse.json(result, { status: 201 });
  },
  { body: true },
);

export const DELETE = courseRoute(
  async ({ identifier, user, body }) => {
    await deleteRoadmapDependencies(
      { userId: user.id, identifier, input: body },
      roadmapChangePort,
    );
    return new NextResponse(null, { status: 204 });
  },
  { body: true },
);
