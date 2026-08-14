import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  getRoadmapDto,
  parseCourseOfferingIdentifier,
  parseJson,
  requireBoolean,
  requireFiniteNumber,
  requireNodeInRoadmap,
  requireRoadmap,
  requireString,
  requireTypeInRoadmap,
  requireUuid,
  optionalString,
} from '@/lib/roadmap-api';
import { requireCourseOfferingTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const body = await parseJson(request);
    const data: {
      title?: string;
      description?: string | null;
      nodeTypeId?: string;
      positionX?: number;
      positionY?: number;
      isVisible?: boolean;
    } = {};

    if ('title' in body) data.title = requireString(body.title, 'title', 240);
    if ('description' in body)
      data.description = optionalString(body.description, 'description') ?? null;
    if ('nodeTypeId' in body) {
      data.nodeTypeId = requireUuid(body.nodeTypeId, 'nodeTypeId');
      await requireTypeInRoadmap(data.nodeTypeId, roadmap.id);
    }
    if ('positionX' in body) data.positionX = requireFiniteNumber(body.positionX, 'positionX');
    if ('positionY' in body) data.positionY = requireFiniteNumber(body.positionY, 'positionY');
    if ('isVisible' in body) data.isVisible = requireBoolean(body.isVisible, 'isVisible');
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Debe indicar al menos un campo para actualizar.',
          },
        },
        { status: 400 },
      );
    }
    await prisma.roadmapNode.update({ where: { id: nodeId }, data });
    const dto = await getRoadmapDto(identifier);
    return NextResponse.json({ node: dto.nodes.find((node) => node.id === nodeId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const nodeId = requireUuid(params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    await prisma.roadmapNode.delete({ where: { id: nodeId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
