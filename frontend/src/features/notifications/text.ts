import type { Domain } from '@/components/ui/DomainDot';
import { formatDateTime, localParts, todayIn, addDays } from '@/lib/dates';
import type { NotificationType } from './types';

/** What each type is, for Settings → Notifications and the lists. Order matches the API's. */
export const TYPE_TEXT: Record<NotificationType, { label: string; description: string; domain: Domain }> = {
  ASSIGNMENT_DUE: {
    label: 'Assignments due soon',
    description: 'An open assignment is due within 24 hours.',
    domain: 'academics',
  },
  TASK_DUE: {
    label: 'Tasks due soon',
    description: 'An open task is due within 24 hours.',
    domain: 'planner',
  },
  TASK_OVERDUE: {
    label: 'Overdue tasks',
    description: 'A task is still open the morning after its deadline.',
    domain: 'planner',
  },
  EXAM_SOON: {
    label: 'Exams coming up',
    description: 'An exam is 3 days away or closer, with how much of your prep is done.',
    domain: 'academics',
  },
  ATTENDANCE_AT_RISK: {
    label: 'Attendance at risk',
    description: 'A course’s attendance drops to “at risk” or below your target.',
    domain: 'academics',
  },
  HACKATHON_DEADLINE: {
    label: 'Hackathon deadlines',
    description: 'Registration or submissions close within 24 hours.',
    domain: 'developer',
  },
  INTERNSHIP_DEADLINE: {
    label: 'Apply-by dates',
    description: 'A saved internship’s apply-by date is within 24 hours.',
    domain: 'developer',
  },
  INTERNSHIP_STEP: {
    label: 'Interviews tomorrow',
    description: 'An application’s next step, usually an interview, is tomorrow.',
    domain: 'developer',
  },
};

const MINUTE = 60_000;

/** "Just now", "12 min ago", "3 h ago", "Yesterday, 14:05", or "Fri 3 Oct, 09:00" (user's timezone). */
export function timeAgo(iso: string, timezone: string, now: Date = new Date()): string {
  const ms = now.getTime() - Date.parse(iso);
  if (ms < MINUTE) return 'Just now';
  if (ms < 60 * MINUTE) return `${Math.floor(ms / MINUTE)} min ago`;
  const { date, time } = localParts(iso, timezone);
  const today = todayIn(timezone, now);
  if (date === today) return `${Math.floor(ms / (60 * MINUTE))} h ago`;
  if (date === addDays(today, -1)) return `Yesterday, ${time}`;
  return formatDateTime(iso, timezone);
}

/** "3 unread" for the bell; "9+" past nine so the badge stays small. */
export const badgeCount = (n: number) => (n > 9 ? '9+' : String(n));
