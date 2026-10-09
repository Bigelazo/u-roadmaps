import 'server-only';

import { prisma } from '@/shared/server/db';
import { isPastRoadmapClosure } from '../domain/closure';
import { chileCalendarDay } from '../domain/scheduled-unlock';

/**
 * The Chilean day and the current Academic term shown on the Practice roadmap: the
 * earliest term whose Roadmap freeze date has not passed, or the term of today.
 */
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

/** Without a configured Academic term: January–July is the first semester, the rest the second. */
function semesterOfMonth(month: number) {
  const lastMonthOfFirstSemester = 7;
  return month <= lastMonthOfFirstSemester ? 1 : 2;
}
