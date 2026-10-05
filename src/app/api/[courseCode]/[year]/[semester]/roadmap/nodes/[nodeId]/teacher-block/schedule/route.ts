import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { scheduleTeacherUnlock } from '@/features/roadmap/server';

type ScheduleContext =
  RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/teacher-block/schedule'>;

async function scheduleInput(context: ScheduleContext, unlockOn: unknown) {
  const [params, user] = await Promise.all([context.params, requireAuthenticatedUser()]);
  return {
    userId: user.id,
    identifier: requireCourseOfferingIdentifier(params),
    id: params.nodeId,
    unlockOn,
  };
}

export async function PUT(request: Request, context: ScheduleContext) {
  return handleApplicationResult(async () => {
    const body = await parseJson(request);
    return NextResponse.json(
      await scheduleTeacherUnlock(await scheduleInput(context, body.unlockOn ?? null)).match(
        (value) => value,
        throwApplicationError,
      ),
    );
  });
}

export async function DELETE(_request: Request, context: ScheduleContext) {
  return handleApplicationResult(async () => {
    return NextResponse.json(
      await scheduleTeacherUnlock(await scheduleInput(context, null)).match(
        (value) => value,
        throwApplicationError,
      ),
    );
  });
}
