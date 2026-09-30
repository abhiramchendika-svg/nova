import type { ClassKind } from './types';

/** Words and ordering for the timetable, shared by the Timetable page, Home and the course page. */

/** ISO weekday (1 = Monday) → name. */
export const DAY_NAME: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export const CLASS_KIND_LABEL: Record<ClassKind, string> = {
  LECTURE: 'Lecture',
  LAB: 'Lab',
  TUTORIAL: 'Tutorial',
  OTHER: 'Class',
};

/** The week in the user's order: Monday first, or Sunday first when that's their setting. */
export function weekOrder(weekStart: 'MON' | 'SUN'): number[] {
  return weekStart === 'SUN' ? [7, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
}

/** "1st class", "2nd class" … for a course's classes on one day. */
export function ordinalClass(slot: number): string {
  const suffix = slot === 1 ? 'st' : slot === 2 ? 'nd' : slot === 3 ? 'rd' : 'th';
  return `${slot}${suffix} class`;
}
