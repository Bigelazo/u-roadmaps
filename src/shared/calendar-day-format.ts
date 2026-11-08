const dayFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const monthFormatter = new Intl.DateTimeFormat('es-CL', { month: 'long' });

const capitalizedParts = new Set<Intl.DateTimeFormatPartTypes>(['weekday', 'month']);

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('es-CL') + text.slice(1);
}

function formatCapitalized(formatter: Intl.DateTimeFormat, date: Date) {
  return formatter
    .formatToParts(date)
    .map(({ type, value }) => (capitalizedParts.has(type) ? capitalize(value) : value))
    .join('');
}

export function formatMonthCaption(month: Date) {
  return `${formatCapitalized(monthFormatter, month)} ${month.getFullYear()}`;
}

export function formatCalendarDay(day: string) {
  return formatCapitalized(dayFormatter, new Date(`${day}T12:00:00.000Z`));
}
