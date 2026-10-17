import 'server-only';
import { prisma } from '@/shared/server/db';
import type { NoticeNodeAccess } from './own-inbox';
import { isNoticeVisible } from '../application/notice-visibility';

/** Whether the Inbox shows the recipient one of their notices; false without a Participation. */
export async function isOwnNoticeVisible(
  userId: string,
  { roadmapId, data }: { roadmapId: string; data: unknown },
  accessibleNodes: NoticeNodeAccess,
) {
  return prisma.$transaction(async (transaction) => {
    const participation = await transaction.participation.findFirst({
      where: { userId, isActive: true, courseOffering: { roadmap: { id: roadmapId } } },
      select: { id: true },
    });
    if (!participation) return false;
    const [nodes, accessible] = await Promise.all([
      transaction.roadmapNode.findMany({
        where: { roadmapId },
        select: { id: true, isVisible: true, nodeTypeId: true },
      }),
      accessibleNodes(transaction, userId, roadmapId),
    ]);
    return isNoticeVisible(data, nodes, accessible);
  });
}
