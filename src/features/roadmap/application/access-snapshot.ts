import 'server-only';
import { NODE_ACCESS_STATES, nodeAccessState } from '@/shared/node-access';
import type { Prisma } from '@/shared/server/db';
import { projectAccessSnapshot, type AccessSnapshot } from './node-change-notifications';

export async function captureAccessSnapshot(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  recipientId?: string,
): Promise<AccessSnapshot> {
  const [nodes, dependencies, participants] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: {
        id: true,
        title: true,
        isVisible: true,
        isTeacherBlocked: true,
        nodeType: { select: { name: true } },
      },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
    transaction.participation.findMany({
      where: {
        courseOffering: { roadmap: { id: roadmapId } },
        isActive: true,
        ...(recipientId ? { userId: recipientId } : {}),
      },
      select: { userId: true, role: true, isActive: true },
    }),
  ]);
  const studentIds = participants
    .filter(({ role }) => role === 'STUDENT')
    .map(({ userId }) => userId);
  const completions = studentIds.length
    ? await transaction.completion.findMany({
        where: { userId: { in: studentIds }, roadmapNode: { roadmapId } },
        select: { userId: true, roadmapNodeId: true },
      })
    : [];
  const snapshot = projectAccessSnapshot({ nodes, dependencies, participants, completions });
  // The first capture records the pre-edit baseline; later captures advance only
  // the current projection. Deferred effects always reconcile committed access.
  for (const { userId } of snapshot.participants) {
    for (const state of NODE_ACCESS_STATES) {
      const ids = nodes
        .filter(
          (node) =>
            nodeAccessState(
              node.isVisible,
              snapshot.accessibleByUser.get(userId)?.has(node.id) ?? false,
            ) === state,
        )
        .map(({ id }) => id);
      if (!ids.length) continue;
      await transaction.nodeContentKnowledge.createMany({
        data: ids.map((nodeId) => ({
          recipientId: userId,
          nodeId,
          target: 'access',
          knownValue: state,
          currentValue: state,
        })),
        skipDuplicates: true,
      });
      await transaction.nodeContentKnowledge.updateMany({
        where: { recipientId: userId, nodeId: { in: ids }, target: 'access' },
        data: { currentValue: state },
      });
    }
  }
  return snapshot;
}
