import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { scheduleTeacherUnlock } from '@/features/roadmap/server';

export const PUT = courseRoute(
  async ({ actor, params, body }) =>
    NextResponse.json(
      await scheduleTeacherUnlock(
        {
          ...actor,
          id: params.nodeId,
          unlockAt: body.unlockAt ?? null,
          includeDependents: body.includeDependents,
        },
        roadmapChangePort,
      ),
    ),
  { body: true },
);

export const DELETE = courseRoute(async ({ actor, params }) =>
  NextResponse.json(
    await scheduleTeacherUnlock({ ...actor, id: params.nodeId, unlockAt: null }, roadmapChangePort),
  ),
);
