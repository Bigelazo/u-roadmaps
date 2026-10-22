import 'server-only';
import type { Prisma } from '@/shared/server/db';

export async function readCourseOfferingTeachingStaff(
  client: Prisma.TransactionClient,
  courseOfferingId: string,
) {
  return client.participation.findMany({
    where: { courseOfferingId, isActive: true, role: 'TEACHER' },
    select: { userId: true, institutionalPosition: true },
  });
}
