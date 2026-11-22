import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import { scheduleTeacherUnlock } from '@/features/roadmap/server';

export const PUT = courseRoute(
  async ({ actor, params, prepared: body }) =>
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
  { prepare: parseJsonObject },
);

export const DELETE = courseRoute(async ({ actor, params }) =>
  NextResponse.json(
    await scheduleTeacherUnlock({ ...actor, id: params.nodeId, unlockAt: null }, roadmapChangePort),
  ),
);
