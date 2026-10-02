/** Developer projects (docs/api.md §2.12). */

export type ProjectStatus = 'IDEA' | 'PLANNING' | 'DEVELOPMENT' | 'COMPLETED' | 'ARCHIVED';

export interface Milestone {
  id: string;
  title: string;
  dueOn: string | null;
  position: number;
  done: boolean;
  doneAt: string | null;
  /** Open and due before today in the user's timezone. */
  overdue: boolean;
}

/** From milestones only; percentage is null without milestones. */
export interface Progress {
  done: number;
  total: number;
  percentage: number | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  status: ProjectStatus;
  startedOn: string | null;
  targetOn: string | null;
  progress: Progress;
  /** The first open milestone in checklist order. */
  nextMilestone: Milestone | null;
  /** Linked tasks that aren't done. */
  openTasks: number;
  milestones: Milestone[];
  createdAt: string;
}

export interface ProjectRequest {
  name: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  status: ProjectStatus;
  startedOn: string | null;
  targetOn: string | null;
}

export interface MilestoneRequest {
  title: string;
  dueOn: string | null;
}

// ───────────── Learning goals (docs/api.md §2.12) ─────────────

export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'DONE';

export interface LearningTopic {
  id: string;
  title: string;
  position: number;
  done: boolean;
  doneAt: string | null;
}

export interface LearningResource {
  id: string;
  title: string;
  url: string;
}

export interface LearningGoal {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  targetOn: string | null;
  /** From topics only; percentage is null without topics. */
  progress: Progress;
  /** The first open topic in checklist order. */
  nextTopic: LearningTopic | null;
  /** Linked study tasks that aren't done. */
  openTasks: number;
  topics: LearningTopic[];
  resources: LearningResource[];
  createdAt: string;
}

export interface GoalRequest {
  title: string;
  description: string | null;
  status: GoalStatus;
  targetOn: string | null;
  /** A starter checklist, read on create only. */
  topics?: string[];
}

export interface ResourceRequest {
  title: string;
  url: string;
}

// ───────────── Hackathons (docs/api.md §2.12) ─────────────

/** Progress only; the outcome is the free-text result. */
export type HackathonStatus =
  'INTERESTED' | 'REGISTERED' | 'PARTICIPATING' | 'SUBMITTED' | 'FINISHED' | 'SKIPPED';
export type HackathonMode = 'ONLINE' | 'OFFLINE' | 'HYBRID';
export type DeadlineKind = 'REGISTRATION' | 'SUBMISSION';

/** The deadline that matters for the status; missed once it has passed. */
export interface HackathonDeadline {
  kind: DeadlineKind;
  at: string;
  missed: boolean;
}

/** An exam within the event's days or two days either side. */
export interface ExamClash {
  examId: string;
  title: string;
  courseCode: string | null;
  on: string;
}

export interface Hackathon {
  id: string;
  name: string;
  organizer: string | null;
  mode: HackathonMode | null;
  location: string | null;
  websiteUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  status: HackathonStatus;
  teamName: string | null;
  teamMembers: string | null;
  projectId: string | null;
  projectName: string | null;
  result: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  certificateUrl: string | null;
  notes: string | null;
  /** Finished, skipped or over. */
  past: boolean;
  /** Days from today to the start (null when undated; 0 or less once it's on). */
  daysUntil: number | null;
  /** Only while it isn't past. */
  deadline: HackathonDeadline | null;
  examClashes: ExamClash[];
  openTasks: number;
  createdAt: string;
}

export interface HackathonRequest {
  name: string;
  organizer: string | null;
  mode: HackathonMode | null;
  location: string | null;
  websiteUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
  status: HackathonStatus;
  teamName: string | null;
  teamMembers: string | null;
  projectId: string | null;
  result: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  certificateUrl: string | null;
  notes: string | null;
}

// ───────────── Internships (docs/api.md §2.12) ─────────────

/** Rejected and withdrawn are closed; the rest are still in play. */
export type InternshipStatus =
  'SAVED' | 'APPLIED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';

export interface StatusChange {
  fromStatus: InternshipStatus | null;
  toStatus: InternshipStatus;
  changedAt: string;
}

export interface Internship {
  id: string;
  company: string;
  role: string;
  location: string | null;
  jobUrl: string | null;
  source: string | null;
  status: InternshipStatus;
  appliedOn: string | null;
  /** Apply by; only matters while saved. */
  deadlineAt: string | null;
  /** Still saved and the apply-by date has passed. */
  deadlineMissed: boolean;
  nextStep: string | null;
  nextStepAt: string | null;
  resumeVersion: string | null;
  notes: string | null;
  openTasks: number;
  /** Every status change, oldest first. */
  history: StatusChange[];
  createdAt: string;
  updatedAt: string;
}

export interface InternshipRequest {
  company: string;
  role: string;
  location: string | null;
  jobUrl: string | null;
  source: string | null;
  status: InternshipStatus;
  /** Null keeps the current one (today once it's sent). */
  appliedOn: string | null;
  deadlineAt: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  resumeVersion: string | null;
  notes: string | null;
}

/** One month's applications (by applied date) and how far they've got, plus the all-time funnel. */
export interface InternshipAnalytics {
  month: string;
  applied: number;
  assessments: number;
  interviews: number;
  offers: number;
  rejected: number;
  responseRate: { value: number | null; formula: string; responded: number; applied: number };
  allTime: {
    saved: number;
    applied: number;
    assessment: number;
    interview: number;
    offer: number;
    rejected: number;
    withdrawn: number;
  };
}

// ───────────── GitHub (docs/api.md §2.13) ─────────────

/** A number NOVA derived, with the formula it used. */
export interface NovaMetric {
  value: number | null;
  formula: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  fork: boolean;
  archived: boolean;
  pushedAt: string | null;
}

export interface GitHubOverview {
  connected: boolean;
  source: 'GITHUB_API';
  username: string | null;
  /** The oldest part shown. */
  fetchedAt: string | null;
  /** A refresh that was due failed; older data is shown. */
  stale: boolean;
  /** GitHub's rate limit resets then. */
  retryAt: string | null;
  profile: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    htmlUrl: string | null;
    publicRepos: number | null;
    followers: number | null;
    following: number | null;
    createdAt: string | null;
  } | null;
  repos: GitHubRepo[] | null;
  languages: { formula: string; shares: { language: string; repos: number; share: number }[] } | null;
  contributions: {
    available: boolean;
    reason: string | null;
    total: number | null;
    fetchedAt: string | null;
    days: { date: string; count: number }[];
  } | null;
  novaMetrics: {
    thisMonth: NovaMetric;
    lastMonth: NovaMetric;
    change: NovaMetric;
    currentStreak: NovaMetric;
    longestStreak: NovaMetric;
    activeWeeks: NovaMetric;
  } | null;
}
