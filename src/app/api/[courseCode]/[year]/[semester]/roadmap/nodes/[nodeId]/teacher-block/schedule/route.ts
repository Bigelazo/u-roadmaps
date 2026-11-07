import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import { scheduleTeacherUnlock } from '@/features/roadmap/server';

export const PUT = courseRoute(
  async ({ identifier, user, params, prepared: body }) =>
    NextResponse.json(
      await scheduleTeacherUnlock(
        {
          userId: user.id,
          identifier,
          id: params.nodeId,
          unlockAt: body.unlockAt ?? null,
          includeDependents: body.includeDependents,
        },
        roadmapChangePort,
      ),
    ),
  { prepare: parseJsonObject, authWithParams: true },
);

export const DELETE = courseRoute(
  async ({ identifier, user, params }) =>
    NextResponse.json(
      await scheduleTeacherUnlock(
        { userId: user.id, identifier, id: params.nodeId, unlockAt: null },
        roadmapChangePort,
      ),
    ),
  { authWithParams: true },
);
