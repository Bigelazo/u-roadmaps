import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  ApiError,
  apiErrorResponse,
  parseCourseOfferingIdentifier,
  parseJson,
  requireNodeInRoadmap,
  requireResourceType,
  requireRoadmap,
  requireString,
  requireUrl,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseOfferingParticipation, requireCourseOfferingTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const body = await parseJson(request);
    const title = requireString(body.title, 'title', 240);
    const url = requireUrl(body.url);
    const type = requireResourceType(body.type);
    const resource = await prisma.resource.create({
      data: { roadmapNodeId: nodeId, title, url, type },
    });
    return NextResponse.json(
      {
        resource: {
          id: resource.id,
          title: resource.title,
          url: resource.url,
          type: resource.type,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]);
    const roadmap = await requireRoadmap(identifier);
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
  } catch (error) {
    return apiErrorResponse(error);
  }
}
