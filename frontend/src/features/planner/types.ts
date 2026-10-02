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
  projectId: string | null;
  projectName: string | null;
  learningGoalId: string | null;
  learningGoalTitle: string | null;
  hackathonId: string | null;
  hackathonName: string | null;
  internshipId: string | null;
  internshipName: string | null;
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
  projectId: string | null;
  learningGoalId: string | null;
  hackathonId: string | null;
  internshipId: string | null;
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
  projectId?: string;
  learningGoalId?: string;
  hackathonId?: string;
  internshipId?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export type TaskPage = Page<Task>;

// ───────────── Calendar (docs/api.md §2.10) ─────────────

export type CalendarItemType =
  | 'CLASS'
  | 'EXAM'
  | 'ASSIGNMENT_DUE'
  | 'TASK'
  | 'TASK_DUE'
  | 'MILESTONE'
  | 'HACKATHON'
  | 'HACKATHON_DEADLINE'
  | 'INTERNSHIP_DEADLINE'
  | 'INTERNSHIP_STEP';

/**
 * One thing on one day. Times are "HH:mm" on the user's wall clock: a block has both (endTime
 * "24:00" if it runs past midnight), a deadline only startTime, an untimed task neither.
 */
export interface CalendarItem {
  key: string;
  type: CalendarItemType;
  refId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  colorHue: number | null;
  location: string | null;
  kind: string | null;
  priority: TaskPriority | null;
  /** For a milestone, its project (refId is the project too). */
  projectId: string | null;
  projectName: string | null;
}

export interface DayLoad {
  date: string;
  deadlines: number;
  exams: number;
  /** Hackathons on that day. */
  hackathons: number;
  /** Internship interviews, assessments and other next steps that day. */
  internshipSteps: number;
  classMinutes: number;
  plannedTaskMinutes: number;
}

export interface CalendarRange {
  from: string;
  to: string;
  timezone: string;
  items: CalendarItem[];
  load: DayLoad[];
}
