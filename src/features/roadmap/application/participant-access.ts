import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { participantNodeAccess, toParticipant } from '@/features/roadmap/domain/participant-view';

export async function readParticipantAccess(
  transaction: Prisma.TransactionClient,
  { userId, roadmapIds }: { userId: string; roadmapIds: readonly string[] },
): Promise<Map<string, ReadonlySet<string>>> {
  const inRoadmaps = { in: [...roadmapIds] };
  const [participations, nodes, dependencies, completions] = await Promise.all([
    transaction.participation.findMany({
      where: { userId, isActive: true, courseOffering: { roadmap: { id: inRoadmaps } } },
      select: { role: true, courseOffering: { select: { roadmap: { select: { id: true } } } } },
    }),
    transaction.roadmapNode.findMany({
      where: { roadmapId: inRoadmaps },
      select: { id: true, roadmapId: true, isVisible: true, isTeacherBlocked: true },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId: inRoadmaps } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
    transaction.completion.findMany({
      where: { userId, roadmapNode: { roadmapId: inRoadmaps } },
      select: { roadmapNodeId: true },
    }),
  ]);
  const completedNodeIds = new Set(completions.map(({ roadmapNodeId }) => roadmapNodeId));
  const nodesByRoadmap = Map.groupBy(nodes, (node) => node.roadmapId);
  const roadmapOfNode = new Map(nodes.map(({ id, roadmapId }) => [id, roadmapId]));
  const dependenciesByRoadmap = Map.groupBy(dependencies, ({ sourceNodeId }) =>
    roadmapOfNode.get(sourceNodeId),
  );
  const access = new Map<string, ReadonlySet<string>>();
  for (const { role, courseOffering } of participations) {
    const roadmapId = courseOffering.roadmap?.id;
    if (!roadmapId) continue;
    const view = participantNodeAccess({
      participant: toParticipant(role, completedNodeIds),
      nodes: nodesByRoadmap.get(roadmapId) ?? [],
      dependencies: dependenciesByRoadmap.get(roadmapId) ?? [],
    });
    access.set(roadmapId, view.accessibleNodeIds);
  }
  return access;
}
