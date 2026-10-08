import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { RoadmapView, RoadmapViewNode } from '../../application/notice-targets';

export type NodeAccessReader = (
  transaction: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
) => Promise<ReadonlySet<string>>;

/** A memoized view of one Roadmap inside a transaction (it sees the transaction's own writes). */
export function roadmapView(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  accessibleNodes?: NodeAccessReader,
): RoadmapView {
  let participants: ReturnType<RoadmapView['participants']> | undefined;
  const nodes = new Map<string, Promise<RoadmapViewNode | null>>();
  const accessible = new Map<string, Promise<ReadonlySet<string>>>();
  return {
    roadmapId,
    participants() {
      participants ??= transaction.participation.findMany({
        where: { courseOffering: { roadmap: { id: roadmapId } }, isActive: true },
        select: { userId: true, role: true },
        orderBy: { userId: 'asc' },
      });
      return participants;
    },
    node(nodeId) {
      let node = nodes.get(nodeId);
      if (!node) {
        node = transaction.roadmapNode.findFirst({
          where: { id: nodeId, roadmapId },
          select: {
            id: true,
            title: true,
            isVisible: true,
            isTeacherBlocked: true,
            nodeTypeId: true,
          },
        });
        nodes.set(nodeId, node);
      }
      return node;
    },
    accessibleNodeIds(userId) {
      if (!accessibleNodes) throw new Error('Node access is not available in this view.');
      let ids = accessible.get(userId);
      if (!ids) {
        ids = accessibleNodes(transaction, userId, roadmapId);
        accessible.set(userId, ids);
      }
      return ids;
    },
  };
}
