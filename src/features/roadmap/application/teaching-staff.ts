import 'server-only';
import { prisma } from '@/shared/server/db';

/** Capture this offering-scoped projection at closure for version authorship. */
export async function readCourseOfferingTeachingStaff(courseOfferingId: string) {
  return prisma.participation.findMany({
    where: { courseOfferingId, isActive: true, role: 'TEACHER' },
    select: {
      institutionalPosition: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });
}
