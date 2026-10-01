import type { Milestone, Project, ProjectStatus } from '@/features/developer/types';
import { addDays, todayIn } from '@/lib/dates';
import type { AcademicStore } from './academics';

/** Projects for the mock API: ports of TechStack.java and ProjectService.java's rules. */

export interface StoredProject {
  id: string;
  name: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  demoUrl: string | null;
  status: ProjectStatus;
  startedOn: string | null;
  targetOn: string | null;
  createdAt: string;
}

export interface StoredMilestone {
  id: string;
  projectId: string;
  title: string;
  dueOn: string | null;
  position: number;
  doneAt: string | null;
}

/** TechStack.normalize: trimmed, blanks dropped, case-insensitive duplicates removed; null on a rule break. */
export function normalizeStack(raw: unknown): { stack: string[] } | { error: string } {
  if (raw == null) return { stack: [] };
  const unique = new Map<string, string>();
  for (const item of raw as (string | null)[]) {
    const t = (item ?? '').trim().replace(/\s+/g, ' ');
    if (!t) continue;
    if (t.length > 30) return { error: 'Keep each technology under 30 characters.' };
    if (!unique.has(t.toLowerCase())) unique.set(t.toLowerCase(), t);
  }
  if (unique.size > 15) return { error: 'List up to 15 technologies.' };
  return { stack: [...unique.values()] };
}

/** WebLinks.normalize: a full http(s) address with a host. */
export function normalizeLink(raw: string | null | undefined): string | null | undefined {
  if (raw == null || !raw.trim()) return null;
  const url = raw.trim();
  try {
    const u = new URL(url);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.host && /^https?:\/\//i.test(url))
      return url;
  } catch {
    // fall through
  }
  return undefined; // invalid
}

export function orderedMilestones(store: AcademicStore, projectId: string): StoredMilestone[] {
  return store.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.position - b.position);
}

export function renumberMilestones(list: StoredMilestone[]): void {
  list.forEach((m, i) => (m.position = i));
}

export function toProject(
  store: AcademicStore,
  p: StoredProject,
  timezone: string,
  now: Date = new Date(),
): Project {
  const today = todayIn(timezone, now);
  const milestones: Milestone[] = orderedMilestones(store, p.id).map((m) => ({
    id: m.id,
    title: m.title,
    dueOn: m.dueOn,
    position: m.position,
    done: m.doneAt !== null,
    doneAt: m.doneAt,
    overdue: m.doneAt === null && m.dueOn !== null && m.dueOn < today,
  }));
  const done = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  return {
    ...p,
    progress: {
      done,
      total,
      percentage: total === 0 ? null : Math.floor((200 * done + total) / (2 * total)),
    },
    nextMilestone: milestones.find((m) => !m.done) ?? null,
    openTasks: store.tasks.filter((t) => t.projectId === p.id && t.status !== 'DONE').length,
    milestones,
  };
}

/** Two clearly fictional demo projects, relative to today in UTC. */
export function seedDemoProjects(store: AcademicStore, now: Date = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  store.projects.push(
    {
      id: '00000000-0000-4000-8000-0000000fc001',
      name: 'Campus bus tracker',
      description: 'Live bus positions for the campus shuttle, from a GPS module and a small web map.',
      techStack: ['Spring Boot', 'React', 'PostgreSQL'],
      repoUrl: 'https://github.com/example/campus-bus-tracker',
      demoUrl: null,
      status: 'DEVELOPMENT',
      startedOn: addDays(today, -40),
      targetOn: addDays(today, 30),
      createdAt: new Date(now.getTime() - 40 * 86_400_000).toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-0000000fc002',
      name: 'Flashcards CLI',
      description: null,
      techStack: ['Rust'],
      repoUrl: null,
      demoUrl: null,
      status: 'IDEA',
      startedOn: null,
      targetOn: null,
      createdAt: new Date(now.getTime() - 5 * 86_400_000).toISOString(),
    },
  );
  const m = (n: number, title: string, dueOn: string | null, done: boolean) =>
    store.milestones.push({
      id: `00000000-0000-4000-8000-0000000fd00${n}`,
      projectId: '00000000-0000-4000-8000-0000000fc001',
      title,
      dueOn,
      position: n - 1,
      doneAt: done ? new Date(now.getTime() - 10 * 86_400_000).toISOString() : null,
    });
  m(1, 'GPS module sends positions', addDays(today, -14), true);
  m(2, 'Map shows live buses', addDays(today, 3), false);
  m(3, 'Arrival estimates', addDays(today, 20), false);
}
