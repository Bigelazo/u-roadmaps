import 'server-only';
import { prisma } from '@/shared/server/db';
import type { ParticipantAccessReader } from './notice-lifecycle';
import { isNoticeVisible } from '../application/notice-visibility';

/** Whether the Inbox shows the recipient one of their notices; false without a Participation. */
export async function isOwnNoticeVisible(
  userId: string,
  { roadmapId, data }: { roadmapId: string; data: unknown },
  readAccess: ParticipantAccessReader,
) {
  return prisma.$transaction(async (transaction) => {
    const [access, nodes] = await Promise.all([
      readAccess(transaction, { userId, roadmapIds: [roadmapId] }),
      transaction.roadmapNode.findMany({
        where: { roadmapId },
        select: { id: true, isVisible: true, nodeTypeId: true },
      }),
    ]);
    const accessible = access.get(roadmapId);
    return accessible !== undefined && isNoticeVisible(data, nodes, accessible);
  });
}
