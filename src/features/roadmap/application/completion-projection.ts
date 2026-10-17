import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  participantNodeAccess,
  studentRoadmapNodes,
} from '@/features/roadmap/domain/participant-view';
import { nodeDto, resourceDto } from '@/features/roadmap/application/roadmap';
import { Prisma } from '@/shared/server/db';

type RoadmapCourse = { code: string; name: string; department: string };
type RoadmapCourseOffering = { id: string; year: number; semester: number };
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
    type: 'FILE' | 'LINK' | 'VIDEO';
    fileKey: string | null;
  }>;
};
type RoadmapDependency = { id: string; sourceNodeId: string; targetNodeId: string };

type RoadmapProjectionData = {
  course: RoadmapCourse;
  courseOffering: RoadmapCourseOffering;
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

export async function loadRoadmapProjectionData(
  transaction: Prisma.TransactionClient,
  {
    courseOffering,
    roadmap,
  }: {
    courseOffering: RoadmapCourseOffering & { course: RoadmapCourse };
    roadmap: { id: string; closedAt?: Date | null };
  },
): Promise<RoadmapProjectionData> {
  const [predefinedNodeTypes, customNodeTypes, nodes, dependencies] = await Promise.all([
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
  ]);

  return {
    course: courseOffering.course,
    courseOffering: {
      id: courseOffering.id,
      year: courseOffering.year,
      semester: courseOffering.semester,
    },
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
  };
}

/** A student's access to each visible Node of a Roadmap; hidden Nodes have no entry. */
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
    course: data.course,
    courseOffering: data.courseOffering,
    roadmap: data.roadmap,
    nodeTypes: data.nodeTypes,
  };
}

function projectAccessibleNode(node: RoadmapNode, identifier: CourseOfferingIdentifier) {
  return {
    ...nodeDto(node),
    resources: node.resources.map((resource) => resourceDto(resource, identifier)),
  };
}

export function projectStudentRoadmap(
  data: RoadmapProjectionData,
  identifier: CourseOfferingIdentifier,
  completedNodeIds: ReadonlySet<string>,
) {
  return {
    ...commonRoadmapProjection(data),
    ...studentRoadmapNodes({
      nodes: data.nodes.map((node) => ({
        ...node,
        resources: node.resources.map((resource) => resourceDto(resource, identifier)),
      })),
      dependencies: data.dependencies,
      completedNodeIds,
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
    nodes: data.nodes.map((node) => projectAccessibleNode(node, identifier)),
    dependencies: data.dependencies,
  };
}
