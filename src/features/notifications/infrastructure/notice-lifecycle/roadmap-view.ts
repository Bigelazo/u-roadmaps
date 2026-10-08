import 'server-only';
import type { Prisma } from '@/shared/server/db';
import { resourceContentState } from '@/shared/server/resource-content-state';
import type {
  RoadmapView,
  RoadmapViewNode,
  RoadmapViewResource,
} from '../../application/notice-targets';

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
  const resources = new Map<string, Promise<RoadmapViewResource | null>>();
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
        node = transaction.roadmapNode
          .findFirst({
            where: { id: nodeId, roadmapId },
            select: {
              id: true,
              title: true,
              description: true,
              isVisible: true,
              isTeacherBlocked: true,
              nodeTypeId: true,
              nodeType: { select: { name: true } },
            },
          })
          .then((found) => {
            if (!found) return null;
            const { nodeType, ...node } = found;
            return { ...node, nodeTypeName: nodeType.name };
          });
        nodes.set(nodeId, node);
      }
      return node;
    },
    resource(resourceId) {
      let resource = resources.get(resourceId);
      if (!resource) {
        resource = transaction.resource
          .findFirst({ where: { id: resourceId, roadmapNode: { roadmapId } } })
          .then((row) =>
            row ? { id: row.id, nodeId: row.roadmapNodeId, ...resourceContentState(row) } : null,
          );
        resources.set(resourceId, resource);
      }
      return resource;
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
