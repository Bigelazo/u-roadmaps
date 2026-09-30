import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { createRoadmapNode, getRoadmapNodesForActor } from '@/features/roadmap/server';
import { deliverNodeChange } from '@/features/notifications/server';

export async function POST(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const [body, user] = await Promise.all([parseJson(request), requireAuthenticatedUser()]);
    const node = await createRoadmapNode({ userId: user.id, identifier, input: body }).match(
      (value) => value,
      throwApplicationError,
    );
    if (node.isVisible) {
      await deliverNodeChange({
        userId: user.id,
        ...identifier,
        nodeId: node.id,
        changeKind: 'node-available',
        changedFields: [],
      }).catch(() => undefined);
    }
    return NextResponse.json({ node }, { status: 201 });
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes'>,
) {
  return handleApplicationResult(async () => {
    const identifier = requireCourseOfferingIdentifier(await context.params);
    const actor = await requireAuthenticatedUser();
    const nodes = await getRoadmapNodesForActor(actor, identifier).match(
      (value) => value,
      throwApplicationError,
    );
    return NextResponse.json({ nodes });
  });
}
