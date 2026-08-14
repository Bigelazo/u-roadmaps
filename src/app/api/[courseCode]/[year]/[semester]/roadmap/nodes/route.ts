import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  getRoadmapDto,
  parseCourseOfferingIdentifier,
  parseJson,
  requireBoolean,
  requireFiniteNumber,
  requireRoadmap,
  requireString,
  requireTypeInRoadmap,
  nodeDto,
  optionalString,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseOfferingParticipation, requireCourseOfferingTeacher } from '@/lib/auth';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const body = await parseJson(request);
    const title = requireString(body.title, 'title', 240);
    const description = optionalString(body.description, 'description');
    const nodeTypeId = requireUuid(body.nodeTypeId, 'nodeTypeId');
    const positionX = requireFiniteNumber(body.positionX, 'positionX');
    const positionY = requireFiniteNumber(body.positionY, 'positionY');
    const isVisible =
      body.isVisible === undefined ? true : requireBoolean(body.isVisible, 'isVisible');
    await requireTypeInRoadmap(nodeTypeId, roadmap.id);
    const node = await prisma.roadmapNode.create({
      data: {
        roadmapId: roadmap.id,
        nodeTypeId,
        title,
        description,
        positionX,
        positionY,
        isVisible,
      },
    });
    return NextResponse.json({ node: nodeDto(node) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const { participation } = await requireCourseOfferingParticipation(identifier, [
      'STUDENT',
      'TEACHER',
    ]);
    const dto = await getRoadmapDto(identifier, participation.role === 'TEACHER');
    return NextResponse.json({ nodes: dto.nodes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
