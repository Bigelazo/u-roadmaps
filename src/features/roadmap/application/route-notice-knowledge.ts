import 'server-only';
import type { Prisma } from '@/shared/server/db';

/** Capture the baseline in the mutation transaction, before deferred delivery can reorder edits. */
export async function captureRouteNoticeKnowledge(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  recipientIds: readonly string[],
  targetKey: string,
  knownValue: string,
) {
  if (!recipientIds.length) return;
  await transaction.routeNoticeKnowledge.createMany({
    data: recipientIds.map((recipientId) => ({ recipientId, roadmapId, targetKey, knownValue })),
    skipDuplicates: true,
  });
}
