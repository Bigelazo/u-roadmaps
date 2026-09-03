import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import type { TeacherBlockOperation } from '@/features/roadmap/types';
import { changeTeacherBlock, previewTeacherBlock } from '@/features/roadmap/server';
import { ApplicationError } from '@/shared/errors/types';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = {
  params: Promise<{ courseCode: string; year: string; semester: string; nodeId: string }>;
};

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

async function teacherBlockInput(context: Context, operation: TeacherBlockOperation) {
  const params = await context.params;
  const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
  return {
    userId: user.id,
    identifier: parseCourseOfferingIdentifier(params),
    id: params.nodeId,
    operation,
  };
}

export async function GET(request: Request, context: Context) {
  return handleApiResult(async () => {
    const preview = await previewTeacherBlock(
      await teacherBlockInput(context, teacherBlockOperation(request)),
    ).match((value) => value, throwApiError);
    return NextResponse.json(preview);
  });
}

export async function POST(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const result = await changeTeacherBlock(await teacherBlockInput(context, 'BLOCK')).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json(result);
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const result = await changeTeacherBlock(await teacherBlockInput(context, 'UNBLOCK')).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json(result);
  });
}

export async function PATCH(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const result = await changeTeacherBlock(
      await teacherBlockInput(context, 'BRANCH_UNLOCK'),
    ).match((value) => value, throwApiError);
    return NextResponse.json(result);
  });
}
