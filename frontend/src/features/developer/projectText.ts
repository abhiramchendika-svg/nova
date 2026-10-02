import type { BadgeTone } from '@/components/ui/Badge';
import type { GoalStatus, ProjectStatus } from './types';

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
