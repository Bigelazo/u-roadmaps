import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import { readCourseOfferingTeachingStaff } from './teaching-staff';
import { isPastRoadmapClosure } from '../domain/closure';

/**
 * Whether each Academic term's Course offerings are past their Roadmap closure
 * instant at `now`, from one read of the synchronized calendar.
 */
export async function readRoadmapClosureCalendar(now = new Date()) {
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
  return (term: { year: number; semester: number }) =>
    isPastRoadmapClosure(term, freezeDates.get(`${term.year}-${term.semester}`) ?? null, now);
}

/** Silent, atomic and irreversible. A later pass retries any transaction that failed. */
export async function closeDueRoadmaps(now = new Date()) {
  const roadmaps = await prisma.roadmap.findMany({
    where: { closedAt: null },
    select: { id: true, courseOffering: { select: { year: true, semester: true } } },
  });
  const isPastClosure = await readRoadmapClosureCalendar(now);
  for (const { id, courseOffering } of roadmaps) {
    // An offering can be deleted between Prisma's candidate and relation reads.
    if (!courseOffering || !isPastClosure(courseOffering)) continue;
    try {
      await prisma.$transaction(
        async (transaction) => {
          // Share the editor's parent-before-Node lock order.
          await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${id}::uuid FOR UPDATE`;
          const roadmap = await transaction.roadmap.findUnique({ where: { id } });
          if (!roadmap || roadmap.closedAt) return;
          // Authorship is the staff active at this instant; later Participation changes keep it.
          const teachingStaff = await readCourseOfferingTeachingStaff(
            transaction,
            roadmap.courseOfferingId,
          );
          await transaction.roadmapClosureTeachingStaff.createMany({
            data: teachingStaff.map(({ userId, institutionalPosition }) => ({
              roadmapId: id,
              userId,
              institutionalPosition,
            })),
          });
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
