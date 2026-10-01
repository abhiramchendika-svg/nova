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
