/**
 * Date helpers for the Home brief. They use the browser's timezone for now; once user
 * settings are wired (Phase 2) they take the saved IANA timezone instead.
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

/** Morning before 12:00, afternoon before 17:00, evening otherwise (local hour). */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
