import 'server-only';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import { studentNodeAccessById } from '@/features/roadmap/domain/access';
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
  roadmap: { id: string };
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
    roadmap: { id: string };
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
    roadmap: { id: roadmap.id },
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

export async function loadStudentNodeAccess(
  transaction: Prisma.TransactionClient,
  { roadmapId, completedNodeIds }: { roadmapId: string; completedNodeIds: ReadonlySet<string> },
) {
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId, isVisible: true },
      select: { id: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    accessByNodeId: studentNodeAccessById({
      nodes,
      dependencies: dependencies.filter(
        (dependency) =>
          visibleNodeIds.has(dependency.sourceNodeId) &&
          visibleNodeIds.has(dependency.targetNodeId),
      ),
      completedNodeIds,
    }),
  };
}

function commonRoadmapProjection(data: RoadmapProjectionData) {
  return {
    course: data.course,
    courseOffering: data.courseOffering,
    roadmap: data.roadmap,
    nodeTypes: data.nodeTypes,
  };
}

function visibleRoadmapData(data: RoadmapProjectionData) {
  const nodes = data.nodes.filter((node) => node.isVisible);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    dependencies: data.dependencies.filter(
      (dependency) =>
        visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId),
    ),
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
  const { nodes, dependencies } = visibleRoadmapData(data);
  const accessByNodeId = studentNodeAccessById({
    nodes,
    dependencies,
    completedNodeIds,
  });

  return {
    ...commonRoadmapProjection(data),
    nodes: nodes.map((node) => {
      const isCompleted = completedNodeIds.has(node.id);
      const access = accessByNodeId.get(node.id);
      if (access?.status === 'BLOCKED') {
        return {
          id: node.id,
          title: node.title,
          positionX: node.positionX,
          positionY: node.positionY,
          nodeTypeId: node.nodeTypeId,
          access,
        };
      }
      return {
        ...projectAccessibleNode(node, identifier),
        access,
        isCompleted,
        canComplete: !isCompleted,
        resources: node.resources.map((resource) => resourceDto(resource, identifier)),
      };
    }),
    dependencies,
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
