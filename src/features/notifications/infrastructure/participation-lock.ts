import 'server-only';
import type { Prisma } from '@/shared/server/db';
import type { ParticipantRole } from '../application/notice-targets';

/** Acquire before the recipient/Roadmap lock so loss waits for delivery and entry. */
export async function lockNoticeParticipation(
  transaction: Prisma.TransactionClient,
  recipientId: string,
  roadmapId: string,
) {
  // Course deletion locks its Roadmap before cascading into Participations.
  // Take the parent lock first so baseline FK writes cannot invert that order.
  await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmapId}::uuid FOR KEY SHARE`;
  const [participation] = await transaction.$queryRaw<
    { isActive: boolean; noticeResetAt: Date | null; role: ParticipantRole }[]
  >`SELECT p."isActive", p."noticeResetAt", p.role FROM "Participation" p
    JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
    WHERE p."userId" = ${recipientId}::uuid AND r.id = ${roadmapId}::uuid
    FOR SHARE OF p`;
  return participation;
}
