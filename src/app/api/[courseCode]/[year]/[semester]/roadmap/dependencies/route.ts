import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { createRoadmapDependency, previewRoadmapDependency } from '@/features/roadmap/server';

function dependencyPreviewQuery(request: Request) {
  const query = new URL(request.url).searchParams;
  const input: Record<string, string> = {
    sourceNodeId: query.get('sourceNodeId') ?? '',
    targetNodeId: query.get('targetNodeId') ?? '',
  };
  for (const field of ['sourceHandle', 'targetHandle'] as const) {
    const value = query.get(field);
    if (value !== null) input[field] = value;
  }
  return input;
}

export const GET = courseRoute(async ({ identifier, user, request }) => {
  const nodes = await previewRoadmapDependency({
    userId: user.id,
    identifier,
    input: dependencyPreviewQuery(request),
  });
  return NextResponse.json(nodes);
});

export const POST = courseRoute(
  async ({ identifier, user, body, request }) => {
    const input = {
      userId: user.id,
      identifier,
      input: body,
      previewVersion: request.headers.get('x-dependency-preview') ?? undefined,
    };
    const result = await createRoadmapDependency(input, roadmapChangePort);
    return NextResponse.json(result, { status: 201 });
  },
  { body: true },
);
