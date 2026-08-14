import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  ApiError,
  ensureTypeNameAvailable,
  normalizeName,
  parseCourseOfferingIdentifier,
  parseJson,
  requireColor,
  requireRoadmap,
  requireString,
  requireUuid,
} from '@/lib/roadmap-api';
import { requireCourseOfferingTeacher } from '@/lib/auth';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; typeId: string }>;
};

async function requireCustomType(typeId: string, roadmapId: string) {
  const nodeType = await prisma.nodeType.findFirst({
    where: { id: typeId, OR: [{ roadmapId }, { isPredefined: true }] },
  });
  if (!nodeType)
    throw new ApiError(
      404,
      'NODE_TYPE_NOT_FOUND',
      'El tipo personalizado no existe en este roadmap.',
    );
  if (nodeType.isPredefined)
    throw new ApiError(409, 'PREDEFINED_TYPE_IMMUTABLE', 'Los tipos predefinidos son inmutables.');
  return nodeType;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    await requireCourseOfferingTeacher(identifier);
    const roadmap = await requireRoadmap(identifier);
    const typeId = requireUuid(params.typeId, 'typeId');
    const nodeType = await requireCustomType(typeId, roadmap.id);
    const body = await parseJson(request);
    const data: { name?: string; normalizedName?: string; color?: string } = {};
    if ('name' in body) {
      data.name = requireString(body.name, 'name', 120);
      data.normalizedName = normalizeName(data.name);
      await ensureTypeNameAvailable(data.name, roadmap.id, nodeType.id);
    }
    if ('color' in body) data.color = requireColor(body.color);
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar nombre o color para actualizar.');
    }
    const updated = await prisma.nodeType.update({ where: { id: nodeType.id }, data });
    return NextResponse.json({
      nodeType: { id: updated.id, name: updated.name, color: updated.color, isPredefined: false },
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
    const typeId = requireUuid(params.typeId, 'typeId');
    const nodeType = await requireCustomType(typeId, roadmap.id);
    const nodesUsingType = await prisma.roadmapNode.count({ where: { nodeTypeId: nodeType.id } });
    if (nodesUsingType > 0) {
      throw new ApiError(
        409,
        'NODE_TYPE_IN_USE',
        'No se puede eliminar un tipo utilizado por nodos.',
      );
    }
    await prisma.nodeType.delete({ where: { id: nodeType.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
