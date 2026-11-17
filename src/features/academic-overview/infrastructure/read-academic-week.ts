import 'server-only';

import { prisma } from '@/shared/server/db';
import { santiagoDate, type AcademicRecess } from '@/integrations/academic-calendar/server';
import { academicWeekLabel } from '../domain/academic-week';

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export async function readAcademicWeekLabel(
  offering?: Readonly<{ year: number; semester: number }>,
  now = new Date(),
) {
  const today = santiagoDate(now).day;
  const term = await prisma.academicTerm.findFirst({
    where: {
      ...(offering && { year: offering.year, semester: offering.semester }),
      classStartDay: { lte: new Date(today) },
      examEndDay: { gte: new Date(today) },
    },
  });
  if (!term?.classStartDay) return null;
  return academicWeekLabel(
    {
      classStartDay: isoDay(term.classStartDay),
      lastClassDay: isoDay(term.lastClassDay),
      examStartDay: isoDay(term.examStartDay),
      examEndDay: isoDay(term.examEndDay),
      recesses: term.recesses as AcademicRecess[],
    },
    today,
  );
}
