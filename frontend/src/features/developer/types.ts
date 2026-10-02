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
