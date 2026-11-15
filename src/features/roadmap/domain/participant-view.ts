import type { Resource, StudentNodeAccess, StudentRoadmapNode } from '@/features/roadmap/types';
import {
  studentAccessGraph,
  studentNodeAccessById,
  studentNodeAccessInGraph,
  visibleRoadmapGraph,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';
import { withResourceReviews } from '@/features/roadmap/domain/resource-review';

export type Participant =
  { role: 'STUDENT'; completedNodeIds: ReadonlySet<string> } | { role: 'TEACHER' };

export function toParticipant(
  role: Participant['role'],
  completedNodeIds: ReadonlySet<string>,
): Participant {
  return role === 'TEACHER' ? { role } : { role, completedNodeIds };
}

type ParticipantNode = { id: string; isVisible: boolean; isTeacherBlocked: boolean };

function teachingStaffAccess({ isTeacherBlocked }: ParticipantNode): StudentNodeAccess {
  return isTeacherBlocked
    ? { status: 'BLOCKED', reason: 'TEACHER_BLOCK' }
    : { status: 'ACCESSIBLE' };
}

export function participantNodeAccess<
  Node extends ParticipantNode,
  Dependency extends RoadmapGraphDependency,
>({
  participant,
  nodes,
  dependencies,
}: {
  participant: Participant;
  nodes: readonly Node[];
  dependencies: readonly Dependency[];
}) {
  const graph = visibleRoadmapGraph(nodes, dependencies);
  const accessByNodeId: ReadonlyMap<string, StudentNodeAccess> =
    participant.role === 'STUDENT'
      ? studentNodeAccessById({
          nodes: graph.nodes,
          dependencies: graph.dependencies,
          completedNodeIds: participant.completedNodeIds,
        })
      : new Map(graph.nodes.map((node) => [node.id, teachingStaffAccess(node)]));
  const accessibleNodeIds: ReadonlySet<string> = accessibleIds(accessByNodeId);
  return { ...graph, accessByNodeId, accessibleNodeIds };
}

function accessibleIds(accessByNodeId: ReadonlyMap<string, StudentNodeAccess>) {
  return new Set(
    [...accessByNodeId].filter(([, access]) => access.status === 'ACCESSIBLE').map(([id]) => id),
  );
}

export function participantAccessibleNodeIds<
  Node extends ParticipantNode,
  Dependency extends RoadmapGraphDependency,
>({ nodes, dependencies }: { nodes: readonly Node[]; dependencies: readonly Dependency[] }) {
  const graph = visibleRoadmapGraph(nodes, dependencies);
  const studentGraph = studentAccessGraph(graph);
  let teachingStaff: ReadonlySet<string> | undefined;
  return (participant: Participant): ReadonlySet<string> => {
    if (participant.role === 'STUDENT')
      return accessibleIds(studentNodeAccessInGraph(studentGraph, participant.completedNodeIds));
    teachingStaff ??= accessibleIds(
      new Map(graph.nodes.map((node) => [node.id, teachingStaffAccess(node)])),
    );
    return teachingStaff;
  };
}

type StudentRoadmapSourceNode = ParticipantNode & {
  title: string;
  nodeTypeId: string;
  positionX: number;
  positionY: number;
  description: string | null;
  resources: Resource[];
};

export type StudentProgress = {
  completedNodeIds: ReadonlySet<string>;
  reviewedResourceIds: ReadonlySet<string>;
};

export function studentRoadmapNodes<Dependency extends RoadmapGraphDependency>({
  nodes,
  dependencies,
  completedNodeIds,
  reviewedResourceIds,
  isClosed,
}: StudentProgress & {
  nodes: readonly StudentRoadmapSourceNode[];
  dependencies: readonly Dependency[];
  isClosed: boolean;
}) {
  const view = participantNodeAccess({
    participant: { role: 'STUDENT', completedNodeIds },
    nodes,
    dependencies,
  });
  return {
    nodes: view.nodes.map((node): StudentRoadmapNode => {
      const summary = {
        id: node.id,
        title: node.title,
        nodeTypeId: node.nodeTypeId,
        positionX: node.positionX,
        positionY: node.positionY,
      };
      const access = view.accessByNodeId.get(node.id) ?? { status: 'ACCESSIBLE' };
      if (access.status === 'BLOCKED') return { ...summary, access };
      const isCompleted = completedNodeIds.has(node.id);
      return {
        ...summary,
        isVisible: true,
        access,
        description: node.description,
        resources: withResourceReviews(node.resources, reviewedResourceIds),
        isCompleted,
        canComplete: !isClosed && !isCompleted,
      };
    }),
    dependencies: view.dependencies,
  };
}
