import 'server-only';
import { prisma } from '@/shared/server/db';
import type { NoticeNodeAccess } from './own-inbox';
import { isNoticeVisible } from '../application/notice-visibility';

/** Load visibility once per Roadmap, before grouping, pagination or counting. */
export async function visibleOwnNotices<T extends { roadmapId: string; data: unknown }>(
  userId: string,
  notices: readonly T[],
  accessibleNodes: NoticeNodeAccess,
): Promise<T[]> {
  return prisma.$transaction(async (transaction) => {
    const contexts = new Map<
      string,
      { nodes: { id: string; isVisible: boolean }[]; accessible: ReadonlySet<string> }
    >();
    for (const roadmapId of new Set(notices.map((notice) => notice.roadmapId))) {
      const participation = await transaction.participation.findFirst({
        where: { userId, isActive: true, courseOffering: { roadmap: { id: roadmapId } } },
        select: { id: true },
      });
      if (!participation) continue;
      const [nodes, accessible] = await Promise.all([
        transaction.roadmapNode.findMany({
          where: { roadmapId },
          select: { id: true, isVisible: true },
        }),
        accessibleNodes(transaction, userId, roadmapId),
      ]);
      contexts.set(roadmapId, { nodes, accessible });
    }
    return notices.filter((notice) => {
      const context = contexts.get(notice.roadmapId);
      return (
        context !== undefined && isNoticeVisible(notice.data, context.nodes, context.accessible)
      );
    });
  });
}
