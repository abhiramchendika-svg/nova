import type { Page, Urgency } from '@/features/academics/types';

/** Planner tasks (docs/api.md §2.9). */

export type TaskCategory = 'ACADEMIC' | 'CODING' | 'PERSONAL' | 'INTERNSHIP' | 'OPEN_SOURCE' | 'PROJECT';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Recurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  /** The day it's planned for (YYYY-MM-DD), if any. */
  plannedFor: string | null;
  /** "HH:mm" on the user's wall clock; only with plannedFor. */
  plannedStart: string | null;
  /** A hard deadline (ISO instant), if any. */
  dueAt: string | null;
  estimatedMinutes: number | null;
  completedAt: string | null;
  recurrence: Recurrence;
  seriesId: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  examId: string | null;
  examTitle: string | null;
  overdue: boolean;
  urgency: Urgency | null;
}

/** Create, or full replacement on update (status changes separately). */
export interface TaskRequest {
  title: string;
  description: string | null;
  category: TaskCategory | null;
  priority: TaskPriority;
  plannedFor: string | null;
  plannedStart: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  recurrence: Recurrence;
  courseId: string | null;
  examId: string | null;
}

export interface StatusResult {
  task: Task;
  /** Completing a repeating task plans the next one; null if it already existed. */
  nextInstance: Task | null;
}

export interface TodayView {
  date: string;
  tasks: Task[];
  completed: Task[];
}

export interface UpcomingView {
  from: string;
  to: string;
  days: { date: string; tasks: Task[] }[];
  unscheduled: Task[];
}

export interface TaskFilter {
  status?: TaskStatus[];
  category?: TaskCategory;
  courseId?: string;
  examId?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export type TaskPage = Page<Task>;
