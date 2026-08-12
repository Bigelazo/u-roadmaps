import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  apiErrorResponse,
  parseCoursePath,
  parseJson,
  requireNodeInRoadmap,
  requireResourceType,
  requireRoadmap,
  requireString,
  requireUrl,
  requireUuid,
} from '@/lib/roadmap-api';

type Context = { params: { ramo: string; anio: string; semestre: string; nodeId: string } };

export async function POST(request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    const nodeId = requireUuid(context.params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const body = await parseJson(request);
    const titulo = requireString(body.titulo, 'titulo', 240);
    const url = requireUrl(body.url);
    const tipo = requireResourceType(body.tipo);
    const resource = await prisma.recurso.create({ data: { nodoId: nodeId, titulo, url, tipo } });
    return NextResponse.json({ recurso: { id: resource.id, titulo: resource.titulo, url: resource.url, tipo: resource.tipo } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(_request: Request, context: Context) {
  try {
    const roadmap = await requireRoadmap(parseCoursePath(context.params));
    const nodeId = requireUuid(context.params.nodeId, 'nodeId');
    await requireNodeInRoadmap(nodeId, roadmap.id);
    const recursos = await prisma.recurso.findMany({ where: { nodoId: nodeId }, orderBy: { titulo: 'asc' } });
    return NextResponse.json({ recursos: recursos.map((resource) => ({
      id: resource.id,
      titulo: resource.titulo,
      url: resource.url,
      tipo: resource.tipo,
    })) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
