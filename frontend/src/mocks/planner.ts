import type { Recurrence, Task, TaskCategory, TaskPriority, TaskStatus } from '@/features/planner/types';
import { addDays, localParts } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { urgencyOf } from './coursework';

/**
 * Planner tasks for the mock API: ports of Recurrence.java, TaskRanking.java and the rules in
 * Task / TaskService, so the UI sees the same answers as it would from Spring Boot.
 */

export interface StoredTask {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  plannedFor: string | null;
  plannedStart: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  completedAt: string | null;
  recurrence: Recurrence;
  seriesId: string | null;
  courseId: string | null;
  examId: string | null;
  projectId: string | null;
  createdAt: number;
}

let created = 0;
/** A strictly increasing creation stamp, so "oldest first" ties never depend on the clock. */
export const nextCreatedAt = () => Date.now() * 1000 + (created++ % 1000);

const PRIORITY_RANK: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Recurrence.next: the day of the instance after one planned for {@code from}. */
export function nextDay(recurrence: Recurrence, from: string): string {
  switch (recurrence) {
    case 'DAILY':
      return addDays(from, 1);
    case 'WEEKLY':
      return addDays(from, 7);
    case 'WEEKDAYS': {
      let d = addDays(from, 1);
      while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = addDays(d, 1);
      return d;
    }
    case 'NONE':
      throw new Error('A one-off task has no next instance');
  }
}

const byNullsLast = <T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : cmp(a, b);
const text = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
const instant = (x: string, y: string) => Date.parse(x) - Date.parse(y);

/** TaskRanking.today: overdue → due today → priority → start time → deadline → oldest. */
export function rankToday(now: Date, endOfToday: number) {
  return (a: StoredTask, b: StoredTask) => {
    const overdue = (t: StoredTask) => (t.dueAt !== null && Date.parse(t.dueAt) < now.getTime() ? 0 : 1);
    const dueToday = (t: StoredTask) => (t.dueAt !== null && Date.parse(t.dueAt) < endOfToday ? 0 : 1);
    return (
      overdue(a) - overdue(b) ||
      dueToday(a) - dueToday(b) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      byNullsLast(a.plannedStart, b.plannedStart, text) ||
      byNullsLast(a.dueAt, b.dueAt, instant) ||
      a.createdAt - b.createdAt
    );
  };
}

/** Within an Upcoming day: start time → priority → deadline → oldest. */
export function rankWithinDay(a: StoredTask, b: StoredTask): number {
  return (
    byNullsLast(a.plannedStart, b.plannedStart, text) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    byNullsLast(a.dueAt, b.dueAt, instant) ||
    a.createdAt - b.createdAt
  );
}

export const isOpenTask = (t: StoredTask) => t.status !== 'DONE';

/** The local calendar day of an instant in a timezone. */
export const localDay = (iso: string, timezone: string) => localParts(iso, timezone).date;

export function toTask(store: AcademicStore, t: StoredTask, now: Date, timezone: string): Task {
  const course = t.courseId ? store.courses.find((c) => c.id === t.courseId) : undefined;
  const exam = t.examId ? store.exams.find((e) => e.id === t.examId) : undefined;
  const project = t.projectId ? store.projects.find((p) => p.id === t.projectId) : undefined;
  const open = isOpenTask(t);
  return {
    ...t,
    courseCode: course?.code ?? null,
    courseName: course?.name ?? null,
    examTitle: exam?.title ?? null,
    projectName: project?.name ?? null,
    overdue: open && t.dueAt !== null && Date.parse(t.dueAt) < now.getTime(),
    urgency: open && t.dueAt !== null ? urgencyOf(t.dueAt, now, timezone) : null,
  };
}

/** Course and exam deletes keep tasks and clear the link (on delete set null in V8). */
export function unlinkTasks(store: AcademicStore, courseIds: Set<string>, examIds: Set<string>): void {
  for (const t of store.tasks) {
    if (t.courseId && courseIds.has(t.courseId)) t.courseId = null;
    if (t.examId && examIds.has(t.examId)) t.examId = null;
  }
}

/** A few clearly fictional tasks for the demo account, relative to today in UTC. */
export function seedDemoTasks(store: AcademicStore, now: Date = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  const course = (name: string) => store.courses.find((c) => c.name === name)?.id ?? null;
  const exam = (title: string) => store.exams.find((e) => e.title === title);
  const at = (days: number, hours: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hours, 0, 0, 0);
    return d.toISOString();
  };
  let n = 0;
  const task = (t: Partial<StoredTask> & { title: string }) => {
    n += 1;
    store.tasks.push({
      id: `00000000-0000-4000-8000-0000000fa${String(n).padStart(3, '0')}`,
      description: null,
      category: 'PERSONAL',
      priority: 'MEDIUM',
      status: 'TODO',
      plannedFor: null,
      plannedStart: null,
      dueAt: null,
      estimatedMinutes: null,
      completedAt: null,
      recurrence: 'NONE',
      seriesId: null,
      courseId: null,
      examId: null,
      projectId: null,
      createdAt: n,
      ...t,
    });
  };
  const midsem = exam('Mid-semester 1');
  task({
    title: 'Two LeetCode mediums',
    category: 'CODING',
    plannedFor: today,
    plannedStart: '21:00',
    recurrence: 'DAILY',
    seriesId: '00000000-0000-4000-8000-00000000fb01',
    estimatedMinutes: 60,
  });
  task({
    title: 'Email the lab TA about the demo slot',
    priority: 'HIGH',
    plannedFor: today,
    dueAt: at(0, 17),
  });
  task({
    title: 'Read the paging chapter',
    category: 'ACADEMIC',
    courseId: course('Operating Systems'),
    plannedFor: addDays(today, -1),
    estimatedMinutes: 45,
  });
  if (midsem) {
    task({
      title: 'Study: SQL joins',
      category: 'ACADEMIC',
      courseId: midsem.courseId,
      examId: midsem.id,
      plannedFor: addDays(today, 2),
      estimatedMinutes: 60,
    });
  }
  task({
    title: 'Update résumé projects section',
    category: 'INTERNSHIP',
    plannedFor: addDays(today, 3),
    priority: 'HIGH',
  });
  task({ title: 'Finish the Rust ownership chapter', category: 'CODING' });
  task({
    title: 'Laundry',
    status: 'DONE',
    plannedFor: today,
    completedAt: at(0, 8) < now.toISOString() ? at(0, 8) : now.toISOString(),
  });
}
