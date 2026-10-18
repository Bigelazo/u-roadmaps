import 'server-only';
import { prisma } from '@/shared/server/db';
import { roadmapView, type ParticipantAccessReader } from './notice-lifecycle';
import { isNoticeVisible } from '../application/notice-visibility';

/** Whether the Inbox shows the recipient one of their notices; false without a Participation. */
export async function isOwnNoticeVisible(
  userId: string,
  { roadmapId, data }: { roadmapId: string; data: unknown },
  readAccess: ParticipantAccessReader,
) {
  return prisma.$transaction(async (transaction) => {
    const [access, nodes, role] = await Promise.all([
      readAccess(transaction, { userId, roadmapIds: [roadmapId] }),
      transaction.roadmapNode.findMany({
        where: { roadmapId },
        select: { id: true, isVisible: true, nodeTypeId: true },
      }),
      roadmapView(transaction, roadmapId).role(userId),
    ]);
    // Access is found only for an active Participation, so it is the one guard needed.
    const accessible = access.get(roadmapId);
    return accessible !== undefined && isNoticeVisible(data, nodes, accessible, role);
  });
}
