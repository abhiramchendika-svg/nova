import { addDays, formatDay } from '@/lib/dates';
import type { Recurrence, TaskCategory, TaskPriority } from './types';

/** Words for task fields, shared by the Tasks page, its dialogs and the exam page. */

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  ACADEMIC: 'Academic',
  CODING: 'Coding',
  PERSONAL: 'Personal',
  INTERNSHIP: 'Internship',
  OPEN_SOURCE: 'Open source',
  PROJECT: 'Project',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];

export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  NONE: 'Doesn’t repeat',
  DAILY: 'Every day',
  WEEKDAYS: 'Every weekday',
  WEEKLY: 'Every week',
};

/** "Today", "Tomorrow", "Yesterday", else "Tue 30 Sep". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDay(date);
}
