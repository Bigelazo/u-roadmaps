import 'server-only';
import type { Prisma } from '@/shared/server/db';

/** Acquire before the recipient/Roadmap lock so loss waits for delivery and entry. */
export async function lockNoticeParticipation(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  const [participation] = await transaction.$queryRaw<
    { isActive: boolean; noticeResetAt: Date | null }[]
  >`SELECT p."isActive", p."noticeResetAt" FROM "Participation" p
    JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
    WHERE p."userId" = ${recipientId}::uuid AND r.id = ${roadmapId}::uuid
    FOR SHARE OF p`;
  return participation;
}
