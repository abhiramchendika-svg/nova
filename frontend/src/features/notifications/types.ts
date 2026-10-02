/** Notifications (docs/api.md §2.15). */

export type NotificationType =
  | 'ASSIGNMENT_DUE'
  | 'TASK_DUE'
  | 'TASK_OVERDUE'
  | 'EXAM_SOON'
  | 'ATTENDANCE_AT_RISK'
  | 'HACKATHON_DEADLINE'
  | 'INTERNSHIP_DEADLINE'
  | 'INTERNSHIP_STEP';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** An in-app path, e.g. /app/academics/exams/{id}. */
  link: string | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: Notification[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface UnreadCount {
  count: number;
}

export interface NotificationPreferences {
  types: { type: NotificationType; enabled: boolean }[];
}
