export type AcademicWeekCalendar = Readonly<{
  classStartDay: string;
  lastClassDay: string;
  examStartDay: string;
  examEndDay: string;
  recesses: ReadonlyArray<Readonly<{ start: string; end: string }>>;
}>;

const DAY_MS = 24 * 60 * 60_000;
const WEEK_MS = 7 * DAY_MS;

function weekMonday(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS;
}

function isRecessWeek(monday: number, calendar: AcademicWeekCalendar) {
  return calendar.recesses.some(
    ({ start, end }) => weekMonday(start) <= monday && monday <= weekMonday(end),
  );
}

export function academicWeekLabel(calendar: AcademicWeekCalendar, today: string) {
  if (today < calendar.classStartDay || today > calendar.examEndDay) return null;

  const current = weekMonday(today);
  const firstExamWeek = weekMonday(calendar.examStartDay);
  if (current >= firstExamWeek) {
    return `Semana de Exámenes ${(current - firstExamWeek) / WEEK_MS + 1}`;
  }
  if (current > weekMonday(calendar.lastClassDay)) return null;

  let classWeeks = 0;
  let recessWeeks = 0;
  for (let monday = weekMonday(calendar.classStartDay); monday <= current; monday += WEEK_MS) {
    if (isRecessWeek(monday, calendar)) recessWeeks += 1;
    else classWeeks += 1;
  }
  return isRecessWeek(current, calendar)
    ? `Semana de receso ${recessWeeks}`
    : `Semana ${classWeeks}`;
}
