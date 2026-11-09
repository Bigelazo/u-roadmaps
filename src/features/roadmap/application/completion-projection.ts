import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  participantNodeAccess,
  studentRoadmapNodes,
  type StudentProgress,
} from '@/features/roadmap/domain/participant-view';
import { nodeDto, resourceDto } from '@/features/roadmap/application/roadmap';
import { Prisma } from '@/shared/server/db';

type RoadmapNode = {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  resources: Array<{
    id: string;
    title: string;
    url: string;
    type: 'FILE' | 'LINK';
    fileKey: string | null;
    fileContentType: string | null;
    fileSize: number | null;
  }>;
};
type RoadmapDependency = { id: string; sourceNodeId: string; targetNodeId: string };

type RoadmapProjectionData = {
  roadmap: { id: string; closedAt?: Date | null };
  nodeTypes: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    isPredefined: boolean;
  }>;
  nodes: RoadmapNode[];
  dependencies: RoadmapDependency[];
  accessCountByResourceId: ReadonlyMap<string, number>;
};

export type RoadmapCompletionScope =
  | { kind: 'COMPLETION'; userId: string; roadmapId: string }
  | { kind: 'SIMULATED_COMPLETION'; participationId: string; roadmapId: string };

export async function loadCompletedNodeIds(
  transaction: Prisma.TransactionClient,
  scope: RoadmapCompletionScope,
): Promise<ReadonlySet<string>> {
  const rows =
    scope.kind === 'COMPLETION'
      ? await transaction.completion.findMany({
          where: { userId: scope.userId, roadmapNode: { roadmapId: scope.roadmapId } },
          select: { roadmapNodeId: true },
        })
      : await transaction.simulatedCompletion.findMany({
          where: { participationId: scope.participationId, roadmapId: scope.roadmapId },
          select: { roadmapNodeId: true },
        });
  return new Set(rows.map(({ roadmapNodeId }) => roadmapNodeId));
}

export async function loadReviewedResourceIds(
  transaction: Prisma.TransactionClient,
  scope: RoadmapCompletionScope,
  nodeId?: string,
): Promise<ReadonlySet<string>> {
  const resource = nodeId
    ? { roadmapNodeId: nodeId, roadmapNode: { roadmapId: scope.roadmapId } }
    : { roadmapNode: { roadmapId: scope.roadmapId } };
  const rows =
    scope.kind === 'COMPLETION'
      ? await transaction.resourceAccess.findMany({
          where: { userId: scope.userId, isReviewed: true, resource },
          select: { resourceId: true },
        })
      : await transaction.simulatedResourceReview.findMany({
          where: { participationId: scope.participationId, resource },
          select: { resourceId: true },
        });
  return new Set(rows.map(({ resourceId }) => resourceId));
}

export async function loadRoadmapProjectionData(
  transaction: Prisma.TransactionClient,
  { roadmap }: { roadmap: { id: string; closedAt?: Date | null } },
): Promise<RoadmapProjectionData> {
  const [predefinedNodeTypes, customNodeTypes, nodes, dependencies, accessCounts] =
    await Promise.all([
      transaction.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
      transaction.nodeType.findMany({ where: { roadmapId: roadmap.id }, orderBy: { name: 'asc' } }),
      transaction.roadmapNode.findMany({
        where: { roadmapId: roadmap.id },
        orderBy: { title: 'asc' },
        include: { resources: { orderBy: { title: 'asc' } } },
      }),
      transaction.dependency.findMany({
        where: { sourceNode: { roadmapId: roadmap.id } },
        orderBy: { id: 'asc' },
      }),
      transaction.resourceAccess.groupBy({
        by: ['resourceId'],
        where: { resource: { roadmapNode: { roadmapId: roadmap.id } } },
        _sum: { accessCount: true },
      }),
    ]);

  return {
    roadmap: { id: roadmap.id, closedAt: roadmap.closedAt },
    nodeTypes: [...predefinedNodeTypes, ...customNodeTypes].map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      color: type.color,
      isPredefined: type.isPredefined,
    })),
    nodes,
    dependencies: dependencies.map(({ id, sourceNodeId, targetNodeId }) => ({
      id,
      sourceNodeId,
      targetNodeId,
    })),
    accessCountByResourceId: new Map(
      accessCounts.map(({ resourceId, _sum }) => [resourceId, _sum.accessCount ?? 0]),
    ),
  };
}

export async function loadStudentNodeAccess(
  transaction: Prisma.TransactionClient,
  { roadmapId, completedNodeIds }: { roadmapId: string; completedNodeIds: ReadonlySet<string> },
) {
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: { id: true, isVisible: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  return participantNodeAccess({
    participant: { role: 'STUDENT', completedNodeIds },
    nodes,
    dependencies,
  }).accessByNodeId;
}

function commonRoadmapProjection(data: RoadmapProjectionData) {
  return {
    roadmap: data.roadmap,
    nodeTypes: data.nodeTypes,
  };
}

function projectedResources(
  data: RoadmapProjectionData,
  node: RoadmapNode,
  identifier: CourseOfferingIdentifier,
) {
  return node.resources.map((resource) =>
    resourceDto(resource, identifier, data.accessCountByResourceId.get(resource.id) ?? 0),
  );
}

export function projectStudentRoadmap(
  data: RoadmapProjectionData,
  identifier: CourseOfferingIdentifier,
  progress: StudentProgress,
) {
  return {
    ...commonRoadmapProjection(data),
    ...studentRoadmapNodes({
      nodes: data.nodes.map((node) => ({
        ...node,
        resources: projectedResources(data, node, identifier),
      })),
      dependencies: data.dependencies,
      ...progress,
      isClosed: Boolean(data.roadmap.closedAt),
    }),
  };
}

export function projectTeacherRoadmap(
  data: RoadmapProjectionData,
  identifier: CourseOfferingIdentifier,
) {
  return {
    ...commonRoadmapProjection(data),
    nodes: data.nodes.map((node) => ({
      ...nodeDto(node),
      resources: projectedResources(data, node, identifier),
    })),
    dependencies: data.dependencies,
  };
}
