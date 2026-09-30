import type {
  Assignment,
  AssignmentPriority,
  AssignmentRequest,
  AssignmentStatus,
  CourseResource,
  ExamKind,
  ExamSummary,
  Prep,
  Urgency,
} from '@/features/academics/types';
import { daysBetween, todayIn } from '@/lib/dates';
import type { AcademicStore } from './academics';

/**
 * Assignments, exams and course links for the mock API: ports of Urgency.java,
 * Assignment.updateProgress, ExamDtos.Prep and WebLinks.java, so the UI sees the same answers
 * as it would from Spring Boot.
 */

export interface StoredAssignment {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueAt: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  estimatedMinutes: number | null;
  progressPct: number;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: number;
}

export interface StoredExam {
  id: string;
  courseId: string;
  title: string;
  kind: ExamKind;
  startsAt: string;
  durationMinutes: number | null;
  location: string | null;
}

export interface StoredTopic {
  id: string;
  examId: string;
  title: string;
  position: number;
  doneAt: string | null;
  createdAt: number;
}

export interface StoredResource extends CourseResource {
  createdAtMs: number;
}

export const OPEN_STATUSES: AssignmentStatus[] = ['NOT_STARTED', 'IN_PROGRESS'];
export const isOpen = (s: AssignmentStatus) => OPEN_STATUSES.includes(s);

/** Urgency.java: calendar days in the user's timezone, so 23:30 → 00:15 is "tomorrow". */
export function urgencyOf(dueAt: string, now: Date, timezone: string): Urgency {
  if (Date.parse(dueAt) < now.getTime()) return 'OVERDUE';
  const days = daysBetween(todayIn(timezone, now), todayIn(timezone, new Date(dueAt)));
  if (days === 0) return 'DUE_TODAY';
  if (days === 1) return 'DUE_TOMORROW';
  return days <= 7 ? 'THIS_WEEK' : 'LATER';
}

/** Assignment.updateProgress: status and progress move together (the database checks the same). */
export function applyProgress(
  a: StoredAssignment,
  newStatus: AssignmentStatus | undefined,
  newProgress: number | undefined,
  nowIso: string,
): void {
  let next = newStatus ?? a.status;
  let progress = newProgress ?? a.progressPct;
  if (newStatus === undefined && next === 'NOT_STARTED' && progress > 0) next = 'IN_PROGRESS';
  switch (next) {
    case 'COMPLETED':
      progress = 100;
      a.completedAt ??= nowIso;
      break;
    case 'SUBMITTED':
      a.completedAt = null;
      a.submittedAt ??= nowIso;
      break;
    case 'IN_PROGRESS':
      a.completedAt = null;
      a.submittedAt = null;
      break;
    case 'NOT_STARTED':
      a.completedAt = null;
      a.submittedAt = null;
      progress = 0;
      break;
  }
  a.status = next;
  a.progressPct = progress;
}

export function toAssignment(
  store: AcademicStore,
  a: StoredAssignment,
  now: Date,
  timezone: string,
): Assignment {
  const course = store.courses.find((c) => c.id === a.courseId);
  const { createdAt: _c, ...rest } = a;
  return {
    ...rest,
    courseCode: course?.code ?? null,
    courseName: course?.name ?? '',
    urgency: isOpen(a.status) ? urgencyOf(a.dueAt, now, timezone) : null,
  };
}

const PRIORITIES: AssignmentPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

/** AssignmentDtos.AssignmentRequest's rules, as [field, message], or null when valid. */
export function assignmentProblem(
  store: AcademicStore,
  body: Partial<AssignmentRequest>,
): [string, string] | null {
  if (!body.courseId || !store.courses.some((c) => c.id === body.courseId)) {
    return ['courseId', 'Choose one of your courses.'];
  }
  if (!body.title?.trim()) return ['title', 'Give the assignment a title.'];
  if (body.title.length > 160) return ['title', 'Keep it under 160 characters.'];
  if (body.description && body.description.length > 4000) {
    return ['description', 'Keep the description under 4000 characters.'];
  }
  if (!body.dueAt || Number.isNaN(Date.parse(body.dueAt))) return ['dueAt', 'Set when it’s due.'];
  if (body.priority != null && !PRIORITIES.includes(body.priority)) {
    return ['priority', 'Choose low, medium or high.'];
  }
  const est = body.estimatedMinutes;
  if (est != null && (!Number.isInteger(est) || est < 1))
    return ['estimatedMinutes', 'Must be at least 1 minute.'];
  if (est != null && est > 10_000) return ['estimatedMinutes', 'That’s more than a week of work.'];
  return null;
}

/** ExamDtos.Prep: a whole percentage rounded half-up, null while the checklist is empty. */
export function prepOf(done: number, total: number): Prep {
  return { done, total, percentage: total === 0 ? null : Math.floor((200 * done + total) / (2 * total)) };
}

export function toExamSummary(store: AcademicStore, e: StoredExam, now: Date, timezone: string): ExamSummary {
  const course = store.courses.find((c) => c.id === e.courseId);
  const topics = store.topics.filter((t) => t.examId === e.id);
  return {
    ...e,
    courseCode: course?.code ?? null,
    courseName: course?.name ?? '',
    daysUntil: daysBetween(todayIn(timezone, now), todayIn(timezone, new Date(e.startsAt))),
    prep: prepOf(topics.filter((t) => t.doneAt).length, topics.length),
  };
}

/** WebLinks.java: only http(s) links with a host, trimmed; null when refused. */
export function normalizeLink(raw: string | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url || url.length > 2048) return null;
  for (const ch of url) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).hostname ? url : null;
  } catch {
    return null;
  }
}

/** Removes everything that hangs off the given courses (the database's on delete cascade). */
export function removeCourseWork(store: AcademicStore, courseIds: Set<string>): void {
  const examIds = new Set(store.exams.filter((e) => courseIds.has(e.courseId)).map((e) => e.id));
  store.records = store.records.filter((r) => !courseIds.has(r.courseId));
  store.assignments = store.assignments.filter((a) => !courseIds.has(a.courseId));
  store.exams = store.exams.filter((e) => !examIds.has(e.id));
  store.topics = store.topics.filter((t) => !examIds.has(t.examId));
  store.resources = store.resources.filter((r) => !courseIds.has(r.courseId));
}

// ───────────── Demo data for `npm run dev:mock` ─────────────

/**
 * Clearly fictional coursework for the demo's current semester, placed relative to {@code now}
 * so the demo always has something overdue, due soon and later. Call after seedDemoAcademics.
 */
export function seedDemoCoursework(store: AcademicStore, now: Date = new Date()): void {
  const course = (name: string) => store.courses.find((c) => c.name === name)!.id;
  const at = (days: number, hours: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hours, 0, 0, 0);
    return d.toISOString();
  };
  let n = 0;
  const assignment = (
    courseName: string,
    title: string,
    dueAt: string,
    priority: AssignmentPriority,
    status: AssignmentStatus = 'NOT_STARTED',
    progressPct = 0,
  ) => {
    n += 1;
    store.assignments.push({
      id: `00000000-0000-4000-8000-0000000da${String(n).padStart(3, '0')}`,
      courseId: course(courseName),
      title,
      description: null,
      dueAt,
      priority,
      status,
      estimatedMinutes: null,
      progressPct,
      submittedAt: status === 'SUBMITTED' || status === 'COMPLETED' ? at(-3, 9) : null,
      completedAt: status === 'COMPLETED' ? at(-3, 9) : null,
      createdAt: n,
    });
  };
  assignment('Operating Systems', 'Scheduler simulation report', at(-1, 18), 'HIGH', 'IN_PROGRESS', 60);
  assignment('Database Systems', 'ER diagram for the library schema', at(1, 18), 'MEDIUM', 'IN_PROGRESS', 30);
  assignment('Compilers', 'Lexer for the toy language', at(3, 18), 'HIGH');
  assignment('Database Systems', 'SQL practice set 4', at(5, 18), 'LOW');
  assignment('Operating Systems', 'Paging worksheet', at(12, 18), 'MEDIUM');
  assignment('Compilers', 'Grammar exercises', at(-4, 18), 'MEDIUM', 'COMPLETED', 100);

  const exam = (
    courseName: string,
    id: string,
    title: string,
    kind: ExamKind,
    days: number,
    topics: string[],
    done: number,
  ) => {
    store.exams.push({
      id,
      courseId: course(courseName),
      title,
      kind,
      startsAt: at(days, 9),
      durationMinutes: 90,
      location: 'Hall B',
    });
    topics.forEach((t, i) =>
      store.topics.push({
        id: `${id}-t${i}`,
        examId: id,
        title: t,
        position: i,
        doneAt: i < done ? at(-1, 9) : null,
        createdAt: i,
      }),
    );
  };
  exam(
    'Database Systems',
    '00000000-0000-4000-8000-0000000de001',
    'Mid-semester 1',
    'MIDTERM',
    9,
    ['ER modelling', 'Normalization', 'SQL joins', 'Transactions'],
    2,
  );
  exam(
    'Compilers',
    '00000000-0000-4000-8000-0000000de002',
    'Quiz 2',
    'QUIZ',
    4,
    ['Regular expressions', 'DFA minimisation'],
    0,
  );

  const link = (courseName: string, title: string, url: string, i: number) =>
    store.resources.push({
      id: `00000000-0000-4000-8000-0000000df${String(i).padStart(3, '0')}`,
      courseId: course(courseName),
      title,
      url,
      createdAt: now.toISOString(),
      createdAtMs: i,
    });
  link('Database Systems', 'Syllabus', 'https://example.edu/cse201/syllabus', 1);
  link('Database Systems', 'Lecture recordings', 'https://example.edu/cse201/lectures', 2);
}
