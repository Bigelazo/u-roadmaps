import { NextResponse } from 'next/server';
import { courseRoute, parseJsonObject } from '@/app/_adapters/http';
import { scheduleTeacherUnlock } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

// The body is read before authentication, so a malformed body wins over a missing session.
export const PUT = courseRoute(
  async ({ identifier, user, params, prepared: body }) =>
    NextResponse.json(
      await unwrap(() =>
        scheduleTeacherUnlock({
          userId: user.id,
          identifier,
          id: params.nodeId,
          unlockOn: body.unlockOn ?? null,
        }),
      ),
    ),
  { prepare: parseJsonObject, authWithParams: true },
);

export const DELETE = courseRoute(
  async ({ identifier, user, params }) =>
    NextResponse.json(
      await unwrap(() =>
        scheduleTeacherUnlock({ userId: user.id, identifier, id: params.nodeId, unlockOn: null }),
      ),
    ),
  { authWithParams: true },
);
