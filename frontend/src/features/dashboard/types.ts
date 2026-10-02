/** Home's aggregate (docs/api.md §2.11). */

export type AttentionKind =
  | 'ASSIGNMENT_OVERDUE'
  | 'TASK_OVERDUE'
  | 'ASSIGNMENT_DUE_SOON'
  | 'TASK_DUE_SOON'
  | 'ATTENDANCE_AT_RISK'
  | 'EXAM_PREP'
  | 'HACKATHON_DEADLINE'
  | 'HACKATHON_EXAM_CLASH'
  | 'INTERNSHIP_DEADLINE';

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

/** Projects, learning and hackathons at a glance; GitHub activity joins in slice 4e. */
export interface DeveloperSummary {
  inDevelopment: number;
  /** Not completed or archived. */
  activeProjects: number;
  nextMilestone: {
    projectId: string;
    projectName: string;
    title: string;
    dueOn: string;
    overdue: boolean;
  } | null;
  activeGoals: number;
  /** The active goal with the nearest target date (then the newest). */
  focusGoal: {
    goalId: string;
    title: string;
    percentage: number | null;
    nextTopic: string | null;
    targetOn: string | null;
  } | null;
  /** Hackathons that aren't past. */
  upcomingHackathons: number;
  /** The upcoming (or ongoing) hackathon that starts soonest; daysUntil is 0 or less once it's on. */
  nextHackathon: {
    hackathonId: string;
    name: string;
    startsOn: string;
    endsOn: string | null;
    daysUntil: number;
    status: string;
  } | null;
  /** Applications sent and still in play. */
  activeApplications: number;
  /** The soonest upcoming interview, assessment or other next step. */
  nextInternshipStep: {
    internshipId: string;
    company: string;
    role: string;
    step: string | null;
    at: string;
  } | null;
  /** Saved GitHub data (null when no username is set); contributionsThisMonth is null without the calendar. */
  github: {
    username: string;
    contributionsThisMonth: number | null;
    lastPushRepo: string | null;
    lastPushAt: string | null;
    fetchedAt: string | null;
  } | null;
}

export interface Dashboard {
  date: string;
  needsAttention: AttentionItem[];
  academics: AcademicsSummary | null;
  planner: PlannerSummary;
  developer: DeveloperSummary;
}
