import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import type { TeacherBlockOperation } from '@/features/roadmap';
import { changeTeacherBlock } from '@/features/roadmap/server';

function changeTeacherBlockRoute(operation: TeacherBlockOperation) {
  return courseRoute(async ({ actor, params, request }) =>
    NextResponse.json(
      await changeTeacherBlock(
        {
          ...actor,
          id: params.nodeId,
          operation,
          previewVersion: request.headers.get('x-change-impact-version') ?? undefined,
        },
        roadmapChangePort,
      ),
    ),
  );
}

export const POST = changeTeacherBlockRoute('BLOCK');
export const DELETE = changeTeacherBlockRoute('UNBLOCK');
export const PATCH = changeTeacherBlockRoute('BRANCH_UNLOCK');
