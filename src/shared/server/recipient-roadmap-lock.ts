import 'server-only';
import type { Prisma } from '@/shared/server/db';

/** Serialize delivery, recognition and Completion access reconciliation. */
export async function lockRecipientRoadmap(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${recipientId}:${roadmapId}`}, 0))`;
}
