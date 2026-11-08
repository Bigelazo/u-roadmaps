export type ZonedWallClock = { day: string; time: string };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function zonedWallClock(instant: Date, timeZone: string): ZonedWallClock {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function wallClockAsUtc({ day, time }: ZonedWallClock) {
  return Date.parse(`${day}T${time}:00.000Z`);
}

function offsetAt(instant: number, timeZone: string) {
  const roundedToMinute = instant - (instant % 60_000);
  return wallClockAsUtc(zonedWallClock(new Date(roundedToMinute), timeZone)) - roundedToMinute;
}

export function zonedInstant(wallClock: ZonedWallClock, timeZone: string): Date {
  const asUtc = wallClockAsUtc(wallClock);
  const firstGuess = asUtc - offsetAt(asUtc, timeZone);
  return new Date(asUtc - offsetAt(firstGuess, timeZone));
}
