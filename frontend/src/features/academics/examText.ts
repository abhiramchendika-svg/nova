import type { ExamKind, Prep } from './types';

/** Words for exams, shared by the course page and (from 2.3c) the Exams pages. */

export const KIND_LABEL: Record<ExamKind, string> = {
  QUIZ: 'Quiz',
  MIDTERM: 'Midterm',
  FINAL: 'Final',
  LAB: 'Lab exam',
  OTHER: 'Exam',
};

/** Calendar days from the server (user's timezone): 0 → "Today", 1 → "Tomorrow", 9 → "In 9 days". */
export function daysUntilText(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return days === -1 ? 'Yesterday' : `${-days} days ago`;
}

export function prepText(prep: Prep): string {
  if (prep.total === 0) return 'No topics listed yet';
  return `${prep.done} of ${prep.total} topics ready`;
}
