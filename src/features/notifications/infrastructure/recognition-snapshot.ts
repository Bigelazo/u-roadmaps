import 'server-only';
import type { Prisma } from '@/shared/server/db';

/** Acknowledge only when the pending target still matches the captured value. */
export async function acknowledgeCapturedNotice(
  transaction: Prisma.TransactionClient,
  identity: { id: string; recipientId: string; roadmapId: string },
  matchesSnapshot: (data: Prisma.JsonValue) => boolean,
): Promise<number> {
  const captured = await transaction.roadmapNotice.findFirst({
    where: { ...identity, acknowledgedAt: null },
  });
  if (!captured || !matchesSnapshot(captured.data)) return 0;
  await transaction.roadmapNotice.update({
    where: { id: captured.id },
    data: { acknowledgedAt: new Date() },
  });
  return 1;
}
