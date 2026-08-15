import { NextResponse } from 'next/server';
import {
  apiErrorResponse,
  createRoadmap,
  parseCourseOfferingIdentifier,
  parseJson,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireRoadmapCreationAccess } from '@/lib/auth';
import { readRoadmapForParticipant } from '@/lib/roadmap-completion';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await readRoadmapForParticipant({ userId: user.id, identifier }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    await requireRoadmapCreationAccess(identifier);
    const roadmap = await createRoadmap(identifier, await parseJson(request));
    return NextResponse.json({ roadmap: { id: roadmap.id }, ...identifier }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
