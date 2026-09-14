import { NextResponse } from 'next/server';
import { handleApplicationResult, throwApplicationError } from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import type { TeacherBlockOperation } from '@/features/roadmap';
import { changeTeacherBlock, previewTeacherBlock } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/types';

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

async function teacherBlockInput(
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block'>,
  operation: TeacherBlockOperation,
  request?: Request,
) {
  const [params, user] = await Promise.all([context.params, requireAuthenticatedUser()]);
  return {
    userId: user.id,
    identifier: requireCourseOfferingIdentifier(params),
    id: params.nodeId,
    operation,
    previewVersion: request?.headers.get('x-teacher-block-preview') ?? undefined,
  };
}

export async function GET(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block'>,
) {
  return handleApplicationResult(async () => {
    const preview = await previewTeacherBlock(
      await teacherBlockInput(context, teacherBlockOperation(request)),
    ).match((value) => value, throwApplicationError);
    return NextResponse.json(preview);
  });
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block'>,
) {
  return handleApplicationResult(async () => {
    const result = await changeTeacherBlock(
      await teacherBlockInput(context, 'BLOCK', request),
    ).match((value) => value, throwApplicationError);
    return NextResponse.json(result);
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block'>,
) {
  return handleApplicationResult(async () => {
    const result = await changeTeacherBlock(
      await teacherBlockInput(context, 'UNBLOCK', request),
    ).match((value) => value, throwApplicationError);
    return NextResponse.json(result);
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block'>,
) {
  return handleApplicationResult(async () => {
    const result = await changeTeacherBlock(
      await teacherBlockInput(context, 'BRANCH_UNLOCK', request),
    ).match((value) => value, throwApplicationError);
    return NextResponse.json(result);
  });
}
