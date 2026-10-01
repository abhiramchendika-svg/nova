/** Today's date (YYYY-MM-DD) in an IANA timezone: the same "today" the backend uses for the user. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "Tue 30 Sep" for a YYYY-MM-DD date (ui-design.md §9), formatted in UTC so the day never shifts. */
export function formatDay(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${isoDate}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')}`;
}

/** The wall-clock date and time ("2026-10-03", "23:59") of an instant in an IANA timezone. */
export function localParts(iso: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

/** Minutes the timezone is ahead of UTC at an instant (IST → 330, New York in summer → −240). */
function offsetMinutes(epochMs: number, timezone: string): number {
  const { date, time } = localParts(new Date(epochMs).toISOString(), timezone);
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  return Math.round((asUtc - Math.floor(epochMs / 60_000) * 60_000) / 60_000);
}

/**
 * The instant (ISO, UTC) at which the clock in {@code timezone} shows {@code date} {@code time}.
 * "Due 3 Oct 23:59" means 23:59 where the student is, whatever the browser's own zone. Two passes
 * settle the offset across DST changes; a time that a DST jump skips resolves to a nearby valid time.
 */
export function zonedToInstant(date: string, time: string, timezone: string): string {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let guess = wall - offsetMinutes(wall, timezone) * 60_000;
  guess = wall - offsetMinutes(guess, timezone) * 60_000;
  return new Date(guess).toISOString();
}

/** "Fri 3 Oct, 23:59" for an instant, in the user's timezone (ui-design.md §9: 24-hour times). */
export function formatDateTime(iso: string, timezone: string): string {
  const { date, time } = localParts(iso, timezone);
  return `${formatDay(date)}, ${time}`;
}

/** Whole calendar days from one YYYY-MM-DD date to another (negative if earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The YYYY-MM-DD date {@code days} after (or before, if negative) another. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
