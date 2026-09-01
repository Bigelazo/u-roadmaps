import { NextResponse } from 'next/server';
import {
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser } from '@/lib/auth';
import { createRoadmapDependency, previewRoadmapDependency } from '@/lib/roadmap-editor';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

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

export async function GET(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const nodes = await previewRoadmapDependency({
      userId: user.id,
      identifier,
      input: dependencyPreviewQuery(request),
    }).match((value) => value, throwApiError);
    return NextResponse.json(nodes);
  });
}

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const [body, user] = await Promise.all([
      parseJson(request),
      requireAuthenticatedUser().match((value) => value, throwApiError),
    ]);
    const result = await createRoadmapDependency({
      userId: user.id,
      identifier,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json(result, { status: 201 });
  });
}
