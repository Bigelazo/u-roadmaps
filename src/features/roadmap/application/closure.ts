import 'server-only';

import { Prisma, prisma } from '@/shared/server/db';
import { readCourseOfferingTeachingStaff } from './teaching-staff';
import { isPastRoadmapClosure } from '../domain/closure';

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

export async function closeDueRoadmaps(now = new Date()) {
  const [roadmaps, isPastClosure] = await Promise.all([
    prisma.roadmap.findMany({
      where: { closedAt: null },
      select: { id: true, courseOffering: { select: { year: true, semester: true } } },
    }),
    readRoadmapClosureCalendar(now),
  ]);
  for (const { id, courseOffering } of roadmaps) {
    if (!courseOffering || !isPastClosure(courseOffering)) continue;
    try {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${id}::uuid FOR UPDATE`;
          const roadmap = await transaction.roadmap.findUnique({ where: { id } });
          if (!roadmap || roadmap.closedAt) return;
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
      console.warn('Roadmap closure failed', { roadmapId: id, error });
    }
  }
}
