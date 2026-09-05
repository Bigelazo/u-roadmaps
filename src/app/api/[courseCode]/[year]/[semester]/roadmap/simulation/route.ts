import { NextResponse } from 'next/server';
import {
  handleApplicationResult as handleApiResult,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
import { parseCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { readSimulatedRoadmap, resetSimulatedCompletions } from '@/features/roadmap/server';
import { requireAuthenticatedUser } from '@/shared/server/session';

type Context = { params: Promise<{ courseCode: string; year: string; semester: string }> };

export async function GET(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    return NextResponse.json(
      await readSimulatedRoadmap({ userId: user.id, identifier }).match(
        (value) => value,
        throwApiError,
      ),
    );
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleApiResult(async () => {
    const identifier = parseCourseOfferingIdentifier(await context.params);
    const user = await requireAuthenticatedUser().match((value) => value, throwApiError);
    const result = await resetSimulatedCompletions({ userId: user.id, identifier }).match(
      (value) => value,
      throwApiError,
    );
    return NextResponse.json({ deletedCount: result.count });
  });
}
