import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  ApiError,
  ensureTypeNameAvailable,
  normalizeName,
  parseCoursePath,
  parseJson,
  requireColor,
  requireRoadmap,
  requireString,
  requireUuid,
} from '@/lib/roadmap-api';

type Context = { params: { ramo: string; anio: string; semestre: string; typeId: string } };

async function requireCustomType(typeId: string, roadmapId: string) {
  const type = await prisma.tipoNodo.findFirst({ where: { id: typeId, OR: [{ roadmapId }, { predefinido: true }] } });
  if (!type) throw new ApiError(404, 'NODE_TYPE_NOT_FOUND', 'El tipo personalizado no existe en este roadmap.');
  if (type.predefinido) throw new ApiError(409, 'PREDEFINED_TYPE_IMMUTABLE', 'Los tipos predefinidos son inmutables.');
  return type;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    const typeId = requireUuid(context.params.typeId, 'typeId');
    const type = await requireCustomType(typeId, roadmap.id);
    const body = await parseJson(request);
    const data: { nombre?: string; nombreNormalizado?: string; color?: string } = {};
    if ('nombre' in body) {
      data.nombre = requireString(body.nombre, 'nombre', 120);
      data.nombreNormalizado = normalizeName(data.nombre);
      await ensureTypeNameAvailable(data.nombre, roadmap.id, type.id);
    }
    if ('color' in body) data.color = requireColor(body.color);
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar nombre o color para actualizar.');
    }
    const updated = await prisma.tipoNodo.update({ where: { id: type.id }, data });
    return NextResponse.json({ tipo: { id: updated.id, nombre: updated.nombre, color: updated.color, predefinido: false } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    const typeId = requireUuid(context.params.typeId, 'typeId');
    const type = await requireCustomType(typeId, roadmap.id);
    const nodesUsingType = await prisma.nodo.count({ where: { tipoNodoId: type.id } });
    if (nodesUsingType > 0) {
      throw new ApiError(409, 'NODE_TYPE_IN_USE', 'No se puede eliminar un tipo utilizado por nodos.');
    }
    await prisma.tipoNodo.delete({ where: { id: type.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
