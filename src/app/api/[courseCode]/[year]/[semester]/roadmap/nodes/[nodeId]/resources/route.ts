import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  ApiError,
  handleApiResult,
  parseCourseOfferingIdentifier,
  parseJson,
  requireNodeInRoadmap,
  requireRoadmap,
  requireUuid,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapResource } from '@/lib/roadmap-editor';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const body = await parseJson(request);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const resource = await createRoadmapResource({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApiError);
    return NextResponse.json({ resource }, { status: 201 });
  });
}

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]).match((value) => value, throwApiError);
    const roadmap = await requireRoadmap(identifier).match((value) => value, throwApiError);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    const node = await requireNodeInRoadmap(nodeId, roadmap.id);
    if (participation.role === 'STUDENT' && !node.isVisible) {
      throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
    }
    const resources = await prisma.resource.findMany({
      where: { roadmapNodeId: nodeId },
      orderBy: { title: 'asc' },
    });
    return NextResponse.json({
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        type: resource.type,
      })),
    });
  });
}
