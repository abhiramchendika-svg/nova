import type { BadgeTone } from '@/components/ui/Badge';
import type { AssignmentPriority, AssignmentStatus, Urgency } from './types';

/** Words for assignment states, shared by the Assignments page and the course page. */

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  COMPLETED: 'Completed',
};

export const PRIORITY_LABEL: Record<AssignmentPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/** Open work is grouped in this order (docs/api.md §2.6). */
export const URGENCY_ORDER: Urgency[] = ['OVERDUE', 'DUE_TODAY', 'DUE_TOMORROW', 'THIS_WEEK', 'LATER'];

export const URGENCY_HEADING: Record<Urgency, string> = {
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due today',
  DUE_TOMORROW: 'Due tomorrow',
  THIS_WEEK: 'This week',
  LATER: 'Later',
};

/**
 * Status tones carry an icon (ui-design.md §2.3): critical for overdue, warning for due within a
 * day. Further-off work gets no chip; its date says enough.
 */
export function urgencyChip(urgency: Urgency | null): { tone: BadgeTone; label: string } | null {
  switch (urgency) {
    case 'OVERDUE':
      return { tone: 'critical', label: 'Overdue' };
    case 'DUE_TODAY':
      return { tone: 'warning', label: 'Due today' };
    case 'DUE_TOMORROW':
      return { tone: 'warning', label: 'Due tomorrow' };
    default:
      return null;
  }
}

/** 90 → "1 h 30 min", 45 → "45 min", 120 → "2 h". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
