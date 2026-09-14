import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
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

export async function GET(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/dependencies'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser();
    const nodes = await previewRoadmapDependency({
      userId: user.id,
      identifier,
      input: dependencyPreviewQuery(request),
    }).match((value) => value, throwApplicationError);
    return NextResponse.json(nodes);
  });
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/dependencies'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const [body, user] = await Promise.all([parseJson(request), requireAuthenticatedUser()]);
    const result = await createRoadmapDependency({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApplicationError);
    return NextResponse.json(result, { status: 201 });
  });
}
