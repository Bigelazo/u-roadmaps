import type { Resource, StudentNodeAccess, StudentRoadmapNode } from '@/features/roadmap/types';
import {
  studentNodeAccessById,
  visibleRoadmapGraph,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';

/**
 * A participant of a Course offering whose Node access is decided. `STUDENT` covers students,
 * observers and Canvas preview (with simulated Completions); teaching staff appear only as
 * Roadmap notice recipients.
 */
export type Participant =
  { role: 'STUDENT'; completedNodeIds: ReadonlySet<string> } | { role: 'TEACHER' };

type ParticipantNode = { id: string; isVisible: boolean; isTeacherBlocked: boolean };

function teachingStaffAccess({ isTeacherBlocked }: ParticipantNode): StudentNodeAccess {
  return isTeacherBlocked
    ? { status: 'BLOCKED', reason: 'TEACHER_BLOCK' }
    : { status: 'ACCESSIBLE' };
}

/** The Nodes that exist for a participant (the visible ones) and the access each one grants. */
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
      : // Teaching staff, as notice recipients: visible and not Teacher-blocked (ADR-0014).
        new Map(graph.nodes.map((node) => [node.id, teachingStaffAccess(node)]));
  const accessibleNodeIds: ReadonlySet<string> = new Set(
    [...accessByNodeId].filter(([, access]) => access.status === 'ACCESSIBLE').map(([id]) => id),
  );
  return { ...graph, accessByNodeId, accessibleNodeIds };
}

type StudentRoadmapSourceNode = ParticipantNode & {
  title: string;
  nodeTypeId: string;
  positionX: number;
  positionY: number;
  description: string | null;
  /** Already mapped by the adapter (the server builds file download URLs). */
  resources: Resource[];
};

/**
 * A student's Roadmap: hidden Nodes are absent, a Blocked node exposes only its id, title,
 * Node type, position and access, and an accessible Node adds its description, Resources and
 * Completion. A retained Completion of a Blocked node stays hidden until every block is removed.
 */
export function studentRoadmapNodes<Dependency extends RoadmapGraphDependency>({
  nodes,
  dependencies,
  completedNodeIds,
  isClosed,
}: {
  nodes: readonly StudentRoadmapSourceNode[];
  dependencies: readonly Dependency[];
  completedNodeIds: ReadonlySet<string>;
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
        resources: node.resources,
        isCompleted,
        canComplete: !isClosed && !isCompleted,
      };
    }),
    dependencies: view.dependencies,
  };
}
