import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import type { TeacherBlockOperation } from '@/features/roadmap';
import { changeTeacherBlock } from '@/features/roadmap/server';

function changeTeacherBlockRoute(operation: TeacherBlockOperation) {
  return courseRoute(
    async ({ user, identifier, params, request }) =>
      NextResponse.json(
        await changeTeacherBlock(
          {
            userId: user.id,
            identifier,
            id: params.nodeId,
            operation,
            previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
          },
          roadmapChangePort,
        ),
      ),
    { authWithParams: true },
  );
}

export const POST = changeTeacherBlockRoute('BLOCK');
export const DELETE = changeTeacherBlockRoute('UNBLOCK');
export const PATCH = changeTeacherBlockRoute('BRANCH_UNLOCK');
