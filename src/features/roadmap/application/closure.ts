import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import { resolveRoadmapFreezeDate, roadmapClosureInstant } from '../domain/closure';

/** Silent, atomic and irreversible. A later pass retries any transaction that failed. */
export async function closeDueRoadmaps(now = new Date()) {
  const roadmaps = await prisma.roadmap.findMany({
    where: { closedAt: null },
    select: { id: true, courseOffering: { select: { year: true, semester: true } } },
  });
  const terms = await prisma.academicTerm.findMany({
    select: {
      year: true,
      semester: true,
      roadmapFreezeDate: true,
    },
  });
  const freezeDates = new Map(
    terms.map((term) => [
      `${term.year}-${term.semester}`,
      term.roadmapFreezeDate.toISOString().slice(0, 10),
    ]),
  );
  for (const { id, courseOffering } of roadmaps) {
    // An offering can be deleted between Prisma's candidate and relation reads.
    if (!courseOffering) continue;
    const day = resolveRoadmapFreezeDate(
      courseOffering,
      freezeDates.get(`${courseOffering.year}-${courseOffering.semester}`) ?? null,
    );
    if (roadmapClosureInstant(day) > now) continue;
    try {
      await prisma.$transaction(
        async (transaction) => {
          // Share the editor's parent-before-Node lock order.
          await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${id}::uuid FOR UPDATE`;
          const roadmap = await transaction.roadmap.findUnique({ where: { id } });
          if (!roadmap || roadmap.closedAt) return;
          await transaction.roadmapNode.updateMany({
            where: { roadmapId: id },
            data: { isTeacherBlocked: false, teacherUnlockOn: null },
          });
          await transaction.roadmap.update({ where: { id }, data: { closedAt: now } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // One contended or failed Roadmap must not prevent the others from closing.
      console.warn('Roadmap closure failed', { roadmapId: id, error });
    }
  }
}
