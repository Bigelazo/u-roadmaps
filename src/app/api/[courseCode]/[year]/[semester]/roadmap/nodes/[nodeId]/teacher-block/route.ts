import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import type { CourseOfferingIdentifier, TeacherBlockOperation } from '@/features/roadmap';
import { changeTeacherBlock, previewTeacherBlock } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/server';

function teacherBlockOperation(request: Request): TeacherBlockOperation {
  const operation = new URL(request.url).searchParams.get('operation');
  if (operation === 'BLOCK' || operation === 'UNBLOCK' || operation === 'BRANCH_UNLOCK') {
    return operation;
  }
  throw new ApplicationError(
    400,
    'INVALID_REQUEST',
    'operation debe ser BLOCK, UNBLOCK o BRANCH_UNLOCK.',
  );
}

type TeacherBlockRoute = {
  user: { id: string };
  identifier: CourseOfferingIdentifier;
  params: Readonly<Record<string, string>>;
};

function teacherBlockInput(
  { user, identifier, params }: TeacherBlockRoute,
  operation: TeacherBlockOperation,
  request?: Request,
) {
  return {
    userId: user.id,
    identifier,
    id: params.nodeId,
    operation,
    previewVersion: request?.headers.get('x-teacher-block-preview') ?? undefined,
  };
}

export const GET = courseRoute(
  async (route) =>
    NextResponse.json(await previewTeacherBlock(teacherBlockInput(route, route.prepared))),
  { prepare: teacherBlockOperation, authWithParams: true },
);

function changeTeacherBlockRoute(operation: TeacherBlockOperation) {
  return courseRoute(
    async (route) =>
      NextResponse.json(
        await changeTeacherBlock(
          teacherBlockInput(route, operation, route.request),
          roadmapChangePort,
        ),
      ),
    { authWithParams: true },
  );
}

export const POST = changeTeacherBlockRoute('BLOCK');
export const DELETE = changeTeacherBlockRoute('UNBLOCK');
export const PATCH = changeTeacherBlockRoute('BRANCH_UNLOCK');
