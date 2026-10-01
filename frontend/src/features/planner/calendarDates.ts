import { addDays } from '@/lib/dates';

/** Calendar date arithmetic on YYYY-MM-DD strings (UTC-based, so a day never shifts). */

export type CalendarView = 'week' | 'month';
export type WeekStart = 'MON' | 'SUN';

export interface DayRange {
  from: string;
  to: string;
  days: string[];
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function startOfWeek(date: string, weekStart: WeekStart): string {
  const back = weekStart === 'MON' ? isoWeekday(date) - 1 : isoWeekday(date) % 7;
  return addDays(date, -back);
}

function span(from: string, count: number): DayRange {
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  return { from, to: days[days.length - 1]!, days };
}

export function weekRange(date: string, weekStart: WeekStart): DayRange {
  return span(startOfWeek(date, weekStart), 7);
}

/** Whole weeks covering the month of {@code date}: 35 or 42 days (28 for a February that fits). */
export function monthRange(date: string, weekStart: WeekStart): DayRange {
  const first = `${date.slice(0, 7)}-01`;
  const last = addDays(`${nextMonth(first)}`, -1);
  const from = startOfWeek(first, weekStart);
  const to = addDays(startOfWeek(last, weekStart), 6);
  const count =
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return span(from, count);
}

function nextMonth(first: string): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function previousMonth(first: string): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/** The date one week or month before or after; months move to the 1st. */
export function shift(view: CalendarView, date: string, direction: 1 | -1): string {
  if (view === 'week') return addDays(date, 7 * direction);
  const first = `${date.slice(0, 7)}-01`;
  return direction === 1 ? nextMonth(first) : previousMonth(first);
}

const fmt = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
/** "Sep" (en-GB would say "Sept"). */
const shortMonth = (date: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const day = (date: string) => String(Number(date.slice(8, 10)));

/** "October 2026". */
export const monthLabel = (date: string) => fmt(date, { month: 'long', year: 'numeric' });

/** "28 Sep – 4 Oct 2026", "5 – 11 Oct 2026", "29 Dec 2026 – 4 Jan 2027". */
export function rangeLabel(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(0, 7) === to.slice(0, 7);
  const start = sameMonth
    ? day(from)
    : `${day(from)} ${shortMonth(from)}${sameYear ? '' : ` ${from.slice(0, 4)}`}`;
  return `${start} – ${day(to)} ${shortMonth(to)} ${to.slice(0, 4)}`;
}

/** "Monday 5 October", for headings read aloud. */
export const longDay = (date: string) => fmt(date, { weekday: 'long', day: 'numeric', month: 'long' });

/** "Mon" and "5", for the compact grid header. */
export const shortWeekday = (date: string) => fmt(date, { weekday: 'short' });
export const dayOfMonth = (date: string) => Number(date.slice(8, 10));
