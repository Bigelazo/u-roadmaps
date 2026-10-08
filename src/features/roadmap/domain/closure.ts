import { chileCalendarDay, type CalendarDay } from './scheduled-unlock';

export function resolveRoadmapFreezeDate(
  term: { year: number; semester: number },
  synchronizedDate: CalendarDay | null,
): CalendarDay {
  return (
    synchronizedDate ?? (term.semester === 1 ? `${term.year}-07-20` : `${term.year + 1}-01-20`)
  );
}

/** Whether Course offerings of the term are past their Roadmap closure instant at `now`. */
export function isPastRoadmapClosure(
  term: { year: number; semester: number },
  synchronizedDate: CalendarDay | null,
  now: Date,
) {
  return roadmapClosureInstant(resolveRoadmapFreezeDate(term, synchronizedDate)) <= now;
}

/** First instant after the last editable Chilean day, including skipped midnights. */
export function roadmapClosureInstant(freezeDate: CalendarDay): Date {
  const midnightUtc = new Date(`${freezeDate}T00:00:00.000Z`).getTime();
  // Search for the calendar boundary rather than assuming a fixed UTC offset.
  let before = midnightUtc;
  let after = midnightUtc + 48 * 60 * 60_000;
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (chileCalendarDay(new Date(middle)) <= freezeDate) before = middle;
    else after = middle;
  }
  return new Date(after);
}
