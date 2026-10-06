import { NextResponse } from 'next/server';
import {
  handleApplicationResult,
  parseJsonObject as parseJson,
  throwApplicationError,
} from '@/app/_adapters/http';
import { requireAuthenticatedUser } from '@/app/_adapters/auth';
import { requireCourseOfferingIdentifier } from '@/app/_adapters/roadmap';
import { deliverRoadmapNodeNotifications } from '@/app/_adapters/roadmap-node-notifications';
import { ApplicationError } from '@/shared/errors/types';
import {
  deleteRoadmapNode,
  previewNodeDeletion,
  previewNodeVisibility,
  updateRoadmapNode,
} from '@/features/roadmap/server';
import { deliverNodeChange } from '@/features/notifications/server';

function previewOperation(request: Request) {
  const operation = new URL(request.url).searchParams.get('operation');
  if (operation === 'HIDE' || operation === 'DELETE') return operation;
  throw new ApplicationError(400, 'INVALID_REQUEST', 'operation debe ser HIDE o DELETE.');
}

async function nodeInput(
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]'>,
) {
  const [params, user] = await Promise.all([context.params, requireAuthenticatedUser()]);
  return {
    userId: user.id,
    identifier: requireCourseOfferingIdentifier(params),
    id: params.nodeId,
  };
}

async function deletionInput(
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]'>,
  request: Request,
) {
  return {
    ...(await nodeInput(context)),
    previewVersion: request.headers.get('x-node-delete-preview') ?? undefined,
  };
}

export async function GET(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]'>,
) {
  return handleApplicationResult(async () => {
    const operation = previewOperation(request);
    const input = await nodeInput(context);
    const preview =
      operation === 'HIDE'
        ? await previewNodeVisibility(input).match((value) => value, throwApplicationError)
        : await previewNodeDeletion(input).match((value) => value, throwApplicationError);
    return NextResponse.json(preview);
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]'>,
) {
  return handleApplicationResult(async () => {
    const [params, body, user] = await Promise.all([
      context.params,
      parseJson(request),
      requireAuthenticatedUser(),
    ]);
    const identifier = requireCourseOfferingIdentifier(params);
    const result = await updateRoadmapNode({
      userId: user.id,
      identifier,
      id: params.nodeId,
      input: body,
    }).match((value) => value, throwApplicationError);
    if (result.notification) {
      await deliverNodeChange({
        userId: user.id,
        ...identifier,
        nodeId: result.node.id,
        changeKind: result.notification.kind,
        changedFields: result.notification.changedFields,
        previousTitle: result.notification.previousTitle,
        nodeTitle: result.node.title,
      }).catch(() => undefined);
    }
    await deliverRoadmapNodeNotifications({
      actorId: user.id,
      identifier,
      notifications: result.notifications ?? [],
    });
    const response = { ...result };
    delete response.notification;
    delete response.notifications;
    return NextResponse.json(response);
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<'/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]'>,
) {
  return handleApplicationResult(async () => {
    const input = await deletionInput(context, request);
    const result = await deleteRoadmapNode(input).match((value) => value, throwApplicationError);
    await deliverRoadmapNodeNotifications({
      actorId: input.userId,
      identifier: input.identifier,
      notifications: result.notifications,
    });
    return new NextResponse(null, { status: 204 });
  });
}
