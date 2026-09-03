import { NextResponse } from 'next/server';
import { prisma } from '@/shared/server/db';
import { requireCourseOfferingParticipation } from '@/features/roadmap/server';
import {
  ApiError,
  handleApiResult,
  parseCourseOfferingIdentifier,
  requireUuid,
  throwApiError,
} from '@/lib/roadmap-api';
import { readUploadedFile } from '@/lib/resource-storage';
import { requireStudentNodeAccess } from '@/lib/roadmap-completion';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; resourceId: string }>;
};

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const params = await context.params;
    const identifier = parseCourseOfferingIdentifier(params);
    const actor = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const { participation, courseOffering } = await requireCourseOfferingParticipation(
      actor,
      identifier,
      ['STUDENT', 'TEACHER'],
    ).match((value) => value, throwApiError);
    const roadmap = courseOffering.roadmap;
    if (!roadmap) {
      throw new ApiError(
        404,
        'ROADMAP_NOT_FOUND',
        'El profesor todavía no ha creado un roadmap para este curso.',
      );
    }
    const resource = await prisma.resource.findFirst({
      where: {
        id: requireUuid(params.resourceId, 'resourceId'),
        roadmapNode: { roadmapId: roadmap.id },
      },
      include: { roadmapNode: { select: { isVisible: true } } },
    });
    if (!resource || !resource.fileKey) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
    }
    if (participation.role === 'STUDENT' && !resource.roadmapNode.isVisible) {
      throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
    }
    if (participation.role === 'STUDENT') {
      await prisma.$transaction((transaction) =>
        requireStudentNodeAccess(transaction, {
          userId: participation.userId,
          roadmapId: roadmap.id,
          nodeId: resource.roadmapNodeId,
        }),
      );
    }
    let file: Buffer;
    try {
      file = await readUploadedFile(resource.fileKey);
    } catch {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El archivo ya no está disponible.');
    }
    return new NextResponse(Uint8Array.from(file).buffer, {
      headers: {
        'Content-Type': resource.fileContentType ?? 'application/octet-stream',
        'Content-Length': String(file.byteLength),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(resource.title)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
