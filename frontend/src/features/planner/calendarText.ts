import { formatMinutes } from '@/features/academics/assignmentText';
import type { CalendarItem, CalendarItemType, DayLoad } from './types';

export const ITEM_LABEL: Record<CalendarItemType, string> = {
  CLASS: 'Class',
  EXAM: 'Exam',
  ASSIGNMENT_DUE: 'Assignment due',
  TASK: 'Task',
  TASK_DUE: 'Task due',
};

/** Where an item lives; tasks open in a dialog instead (null). */
export function itemHref(item: CalendarItem): string | null {
  switch (item.type) {
    case 'CLASS':
      return item.courseId ? `/app/academics/courses/${item.courseId}` : null;
    case 'EXAM':
      return `/app/academics/exams/${item.refId}`;
    case 'ASSIGNMENT_DUE':
      return item.courseId
        ? `/app/academics/assignments?course=${item.courseId}`
        : '/app/academics/assignments';
    default:
      return null;
  }
}

/** "09:00–09:50", "Due 23:59", or null for an untimed task. */
export function itemTime(item: CalendarItem): string | null {
  if (!item.startTime) return null;
  if (!item.endTime) return `Due ${item.startTime}`;
  return `${item.startTime}–${item.endTime}`;
}

/** What a screen reader hears: "Exam: Mid-semester 1, CSE 201, 10:00–11:30, Hall B". */
export function itemDescription(item: CalendarItem): string {
  const parts = [`${ITEM_LABEL[item.type]}: ${item.title}`];
  if (item.type !== 'CLASS' && (item.courseCode ?? item.courseName))
    parts.push(item.courseCode ?? item.courseName!);
  const time = itemTime(item);
  if (time) parts.push(time);
  if (item.location) parts.push(item.location);
  if (item.done) parts.push('done');
  return parts.join(', ');
}

/** Busy-ness in minute-equivalents: an exam counts as two hours, a deadline as one. */
export function loadScore(load: DayLoad): number {
  return load.classMinutes + load.plannedTaskMinutes + load.exams * 120 + load.deadlines * 60;
}

/** A full day is about eight hours' worth; the bar caps there. */
export const FULL_DAY = 8 * 60;

/** "1 exam · 2 deadlines · 3 h 20 min of classes · 45 min planned", or null on an empty day. */
export function loadText(load: DayLoad): string | null {
  const parts: string[] = [];
  if (load.exams) parts.push(load.exams === 1 ? '1 exam' : `${load.exams} exams`);
  if (load.deadlines) parts.push(load.deadlines === 1 ? '1 deadline' : `${load.deadlines} deadlines`);
  if (load.classMinutes) parts.push(`${formatMinutes(load.classMinutes)} of classes`);
  if (load.plannedTaskMinutes) parts.push(`${formatMinutes(load.plannedTaskMinutes)} planned`);
  return parts.length ? parts.join(' · ') : null;
}
