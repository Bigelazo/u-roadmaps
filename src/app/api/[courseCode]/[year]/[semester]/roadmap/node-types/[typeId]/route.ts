import { roadmapChangePort } from '@/app/_adapters/roadmap-changes';
import { NextResponse } from 'next/server';
import { courseRoute } from '@/app/_adapters/http';
import { deleteRoadmapNodeType, updateRoadmapNodeType } from '@/features/roadmap/server';
import { unwrap } from '@/shared/errors/server';

export const PATCH = courseRoute(
  async ({ identifier, user, params, body }) => {
    const result = await unwrap(() =>
      updateRoadmapNodeType(
        { userId: user.id, identifier, id: params.typeId, input: body },
        roadmapChangePort,
      ),
    );
    return NextResponse.json({ nodeType: result.nodeType });
  },
  { body: true },
);

export const DELETE = courseRoute(async ({ identifier, user, params }) => {
  await unwrap(() => deleteRoadmapNodeType({ userId: user.id, identifier, id: params.typeId }));
  return new NextResponse(null, { status: 204 });
});
