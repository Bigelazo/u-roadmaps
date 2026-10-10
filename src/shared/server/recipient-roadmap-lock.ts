import 'server-only';
import type { Prisma } from '@/shared/server/db';

/**
 * Serialize everything that writes one recipient's notices and Known values of a Roadmap:
 * notice delivery, recognition (Inbox opening and Roadmap entry) and the actor's own
 * changes (the actor rule, taken inside the roadmap transaction).
 */
export async function lockRecipientRoadmap(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${recipientId}:${roadmapId}`}, 0))`;
}
