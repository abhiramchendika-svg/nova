import type { BadgeTone } from '@/components/ui/Badge';
import { formatDay } from '@/lib/dates';
import type { DeadlineKind, GoalStatus, HackathonMode, HackathonStatus, ProjectStatus } from './types';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  IDEA: 'Idea',
  PLANNING: 'Planning',
  DEVELOPMENT: 'In development',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

/** Choices in the form, in lifecycle order. */
export const STATUSES: ProjectStatus[] = ['IDEA', 'PLANNING', 'DEVELOPMENT', 'COMPLETED', 'ARCHIVED'];

/** The Projects page shows what's being built first; archived ones sit behind a toggle. */
export const GROUP_ORDER: ProjectStatus[] = ['DEVELOPMENT', 'PLANNING', 'IDEA', 'COMPLETED'];

export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  IDEA: 'neutral',
  PLANNING: 'neutral',
  DEVELOPMENT: 'developer',
  COMPLETED: 'good',
  ARCHIVED: 'neutral',
};

/** "github.com/abhi/nova" from "https://github.com/abhi/nova/": readable, still the real link. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

// ───────────── Learning goals ─────────────

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  DONE: 'Done',
};

export const GOAL_STATUSES: GoalStatus[] = ['ACTIVE', 'PAUSED', 'DONE'];

// ───────────── Hackathons ─────────────

export const HACKATHON_STATUS_LABEL: Record<HackathonStatus, string> = {
  INTERESTED: 'Interested',
  REGISTERED: 'Registered',
  PARTICIPATING: 'Participating',
  SUBMITTED: 'Submitted',
  FINISHED: 'Finished',
  SKIPPED: 'Skipped',
};

/** Choices in the form, in the order a hackathon goes. */
export const HACKATHON_STATUSES: HackathonStatus[] = [
  'INTERESTED',
  'REGISTERED',
  'PARTICIPATING',
  'SUBMITTED',
  'FINISHED',
  'SKIPPED',
];

export const HACKATHON_STATUS_TONE: Record<HackathonStatus, BadgeTone> = {
  INTERESTED: 'neutral',
  REGISTERED: 'developer',
  PARTICIPATING: 'developer',
  SUBMITTED: 'developer',
  FINISHED: 'good',
  SKIPPED: 'neutral',
};

export const MODE_LABEL: Record<HackathonMode, string> = {
  ONLINE: 'Online',
  OFFLINE: 'In person',
  HYBRID: 'Hybrid',
};

export const DEADLINE_LABEL: Record<DeadlineKind, { open: string; missed: string }> = {
  REGISTRATION: { open: 'Registration closes', missed: 'Registration closed' },
  SUBMISSION: { open: 'Submissions close', missed: 'Submissions closed' },
};

/** "Sat 10 Oct", "Sat 10 – Sun 11 Oct", or null when undated. */
export function eventDates(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn) return null;
  if (!endsOn || endsOn === startsOn) return formatDay(startsOn);
  const [sw, sd, sm] = formatDay(startsOn).split(' ');
  const end = formatDay(endsOn);
  return sm === end.split(' ')[2] ? `${sw} ${sd} – ${end}` : `${formatDay(startsOn)} – ${end}`;
}

/** "On now", "Today", "Tomorrow", "In 5 days" for a hackathon that isn't past; null when undated. */
export function countdown(daysUntil: number | null): string | null {
  if (daysUntil === null) return null;
  if (daysUntil < 0) return 'On now';
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}
