/** Home's aggregate (docs/api.md §2.11). */

export type AttentionKind =
  | 'ASSIGNMENT_OVERDUE'
  | 'TASK_OVERDUE'
  | 'ASSIGNMENT_DUE_SOON'
  | 'TASK_DUE_SOON'
  | 'ATTENDANCE_AT_RISK'
  | 'EXAM_PREP';

export interface AttentionItem {
  kind: AttentionKind;
  refId: string;
  title: string;
  courseCode: string | null;
  /** Why it's here, in plain words: "Overdue by 2 days", "60% · below your 75% target…". */
  reason: string;
  /** 0–100, from PriorityScorer; the list arrives highest first. */
  score: number;
  /** Where to deal with it, an in-app path. */
  link: string;
}

export interface AcademicsSummary {
  semesterId: string;
  semesterName: string;
  gpa: number | null;
  cgpa: number | null;
  credits: number;
  lowestAttendance: {
    courseId: string;
    courseName: string;
    percentage: number;
    target: number | null;
  } | null;
}

export interface PlannerSummary {
  openToday: number;
  doneToday: number;
  weekDone: number;
  weekPlanned: number;
  /** Days in a row with a finished task; null until it reaches 3. */
  streakDays: number | null;
}

export interface Dashboard {
  date: string;
  needsAttention: AttentionItem[];
  academics: AcademicsSummary | null;
  planner: PlannerSummary;
}
