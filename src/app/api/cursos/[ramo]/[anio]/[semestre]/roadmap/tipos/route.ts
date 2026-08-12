import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  ensureTypeNameAvailable,
  getAvailableTypes,
  normalizeName,
  parseCoursePath,
  parseJson,
  requireColor,
  requireRoadmap,
  requireString,
} from '@/lib/roadmap-api';

type Context = { params: { ramo: string; anio: string; semestre: string } };

export async function GET(_request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    return NextResponse.json({ tipos: await getAvailableTypes(roadmap.id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    const body = await parseJson(request);
    const nombre = requireString(body.nombre, 'nombre', 120);
    const color = requireColor(body.color);
    await ensureTypeNameAvailable(nombre, roadmap.id);
    const tipo = await prisma.tipoNodo.create({
      data: { roadmapId: roadmap.id, nombre, nombreNormalizado: normalizeName(nombre), color, predefinido: false },
    });
    return NextResponse.json({ tipo: { id: tipo.id, nombre: tipo.nombre, color: tipo.color, predefinido: false } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
