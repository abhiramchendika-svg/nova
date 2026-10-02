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
