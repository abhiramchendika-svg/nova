/**
 * Date helpers for the Home brief. Home passes the user's saved IANA timezone, so the date and
 * greeting match the "today" the server uses; without one they fall back to the browser's.
 */

/** e.g. "WED 30 SEP" */
export function formatBriefDate(date: Date, locale = 'en-US', timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`.toUpperCase();
}

/** Morning before 12:00, afternoon before 17:00, evening otherwise, by the clock in {@code timeZone} (default: the browser's). */
export function greetingFor(date: Date, timeZone?: string): string {
  const hour = timeZone
    ? Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date))
    : date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
