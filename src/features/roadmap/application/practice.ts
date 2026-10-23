import 'server-only';

import { prisma } from '@/shared/server/db';
import { isPastRoadmapClosure } from '../domain/closure';
import { chileCalendarDay } from '../domain/scheduled-unlock';

export async function readPracticeRoadmapCalendar(now = new Date()) {
  const today = chileCalendarDay(now);
  const terms = await prisma.academicTerm.findMany({
    select: { year: true, semester: true, roadmapFreezeDate: true },
    orderBy: [{ year: 'asc' }, { semester: 'asc' }],
  });
  const current = terms.find(
    (term) => !isPastRoadmapClosure(term, term.roadmapFreezeDate.toISOString().slice(0, 10), now),
  );
  if (current) return { term: { year: current.year, semester: current.semester }, today };
  const [year, month] = today.split('-').map(Number);
  return { term: { year, semester: semesterOfMonth(month) }, today };
}

const LAST_MONTH_OF_FIRST_SEMESTER = 7;

function semesterOfMonth(month: number) {
  return month <= LAST_MONTH_OF_FIRST_SEMESTER ? 1 : 2;
}
