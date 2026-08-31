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
  resourceDto,
  throwApiError,
} from '@/lib/roadmap-api';
import { requireAuthenticatedUser, requireCourseOfferingParticipation } from '@/lib/auth';
import { createRoadmapResource, createUploadedRoadmapResource } from '@/lib/roadmap-editor';
import { deleteUploadedFile, saveUploadedFile, validateUploadedFile } from '@/lib/resource-storage';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        throw new ApiError(400, 'INVALID_REQUEST', 'Debes seleccionar un archivo para subir.');
      }
      try {
        validateUploadedFile(file);
      } catch (error) {
        if (error instanceof Error && error.message === 'EMPTY_FILE') {
          throw new ApiError(400, 'INVALID_REQUEST', 'El archivo seleccionado está vacío.');
        }
        if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
          throw new ApiError(400, 'INVALID_REQUEST', 'El archivo no puede superar los 25 MB.');
        }
        throw error;
      }
      const fileKey = crypto.randomUUID();
      await saveUploadedFile(fileKey, file);
      try {
        const resource = await createUploadedRoadmapResource({
          userId: user.id,
          identifier,
          id: params.nodeId,
          title: file.name,
          fileKey,
          fileContentType: file.type || null,
        }).match((value) => value, throwApiError);
        return NextResponse.json({ resource }, { status: 201 });
      } catch (error) {
        await deleteUploadedFile(fileKey);
        throw error;
      }
    }
    const body = await parseJson(request);
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
    const [{ participation }, roadmap] = await Promise.all([
      requireCourseOfferingParticipation(identifier, ['STUDENT', 'TEACHER']).match(
        (value) => value,
        throwApiError,
      ),
      requireRoadmap(identifier).match((value) => value, throwApiError),
    ]);
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
      resources: resources.map((resource) => resourceDto(resource, identifier)),
    });
  });
}
