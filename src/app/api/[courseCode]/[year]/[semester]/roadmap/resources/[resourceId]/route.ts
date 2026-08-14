import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  parseCourseOfferingIdentifier,
  parseJson,
  requireResourceInRoadmap,
  requireResourceType,
  requireRoadmap,
  requireString,
  requireUrl,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseOfferingTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; resourceId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const resourceId = requireUuid(params.resourceId, 'resourceId');
    await requireResourceInRoadmap(resourceId, roadmap.id);
    const body = await parseJson(request);
    const data: { title?: string; url?: string; type?: 'FILE' | 'LINK' | 'VIDEO' } = {};
    if ('title' in body) data.title = requireString(body.title, 'title', 240);
    if ('url' in body) data.url = requireUrl(body.url);
    if ('type' in body) data.type = requireResourceType(body.type);
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
    const resource = await prisma.resource.update({ where: { id: resourceId }, data });
    return NextResponse.json({
      resource: { id: resource.id, title: resource.title, url: resource.url, type: resource.type },
    });
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
    const resourceId = requireUuid(params.resourceId, 'resourceId');
    await requireResourceInRoadmap(resourceId, roadmap.id);
    await prisma.resource.delete({ where: { id: resourceId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
