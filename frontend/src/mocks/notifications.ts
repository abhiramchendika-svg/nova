import type { Notification, NotificationType } from '@/features/notifications/types';
import type { SettingsRequest } from '@/features/settings/types';
import { addDays, localParts, todayIn, formatDay } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { courseAttendance } from './attendance';
import { isOpen, toExamSummary } from './coursework';
import { applyByReason, deadlineReason, hackathonDeadlineReason } from './dashboard';
import { toHackathon } from './hackathons';
import { deadlineMatters, stepMatters } from './internships';

/**
 * Notifications for the mock API: a port of NotificationRules.java and NotificationGenerator.java.
 * The real server runs the generator hourly; the mock runs it whenever the bell or the list asks,
 * so new reminders appear straight away. The dedupe key keeps it to once per reminder, as on the server.
 */

export interface StoredNotification extends Notification {
  dedupeKey: string;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  'ASSIGNMENT_DUE',
  'TASK_DUE',
  'TASK_OVERDUE',
  'EXAM_SOON',
  'ATTENDANCE_AT_RISK',
  'HACKATHON_DEADLINE',
  'INTERNSHIP_DEADLINE',
  'INTERNSHIP_STEP',
];

const HOUR = 3_600_000;
const DUE_WINDOW = 24 * HOUR;
const OVERDUE_LOOKBACK = 7 * 24 * HOUR;
const EXAM_DAYS = 3;
const MORNING = '08:00';
const TITLE_MAX = 160;

const clip = (s: string, max: number) => {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};
const percent = (n: number) => `${Number(n.toFixed(1))}%`;

interface Draft {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
}

/** NotificationRules.attendanceWorsened. */
export function attendanceWorsened(previous: string | undefined, current: string): boolean {
  if (current === 'BELOW') return previous !== 'BELOW';
  if (current === 'AT_RISK') return previous !== 'AT_RISK' && previous !== 'BELOW';
  return false;
}

/** Creates the user's new notifications as of {@code now}; returns how many. */
export function generateNotifications(
  store: AcademicStore,
  settings: SettingsRequest,
  now: Date = new Date(),
): number {
  const tz = settings.timezone;
  const nowMs = now.getTime();
  const today = todayIn(tz, now);
  const on = (t: NotificationType) => !store.notificationMutes.includes(t);
  const drafts: Draft[] = [];
  const codeOf = (courseId: string | null) => {
    const c = courseId ? store.courses.find((x) => x.id === courseId) : undefined;
    return c ? (c.code ?? c.name) : null;
  };
  const withContext = (context: string | null, text: string) => (context ? `${context} · ${text}` : text);
  const inWindow = (iso: string | null) => {
    if (!iso) return false;
    const at = Date.parse(iso);
    return at >= nowMs && at < nowMs + DUE_WINDOW;
  };

  if (on('ASSIGNMENT_DUE')) {
    for (const a of store.assignments.filter((x) => isOpen(x.status) && inWindow(x.dueAt))) {
      drafts.push({
        type: 'ASSIGNMENT_DUE',
        title: a.title,
        body: withContext(codeOf(a.courseId), deadlineReason(a.dueAt, false, today, tz)),
        link: `/app/academics/assignments?course=${a.courseId}`,
        dedupeKey: `ASSIGNMENT_DUE:${a.id}:${localParts(a.dueAt, tz).date}`,
      });
    }
  }
  const openTasks = store.tasks.filter((t) => t.status !== 'DONE' && t.dueAt);
  if (on('TASK_DUE')) {
    for (const t of openTasks.filter((x) => inWindow(x.dueAt))) {
      drafts.push({
        type: 'TASK_DUE',
        title: t.title,
        body: withContext(codeOf(t.courseId), deadlineReason(t.dueAt!, false, today, tz)),
        link: `/app/planner/tasks?task=${t.id}`,
        dedupeKey: `TASK_DUE:${t.id}:${localParts(t.dueAt!, tz).date}`,
      });
    }
  }
  if (on('TASK_OVERDUE') && localParts(now.toISOString(), tz).time >= MORNING) {
    for (const t of openTasks) {
      const at = Date.parse(t.dueAt!);
      const dueDay = localParts(t.dueAt!, tz).date;
      if (at >= nowMs || at < nowMs - OVERDUE_LOOKBACK || dueDay >= today) continue;
      drafts.push({
        type: 'TASK_OVERDUE',
        title: t.title,
        body: withContext(codeOf(t.courseId), `${deadlineReason(t.dueAt!, true, today, tz)} · still open`),
        link: `/app/planner/tasks?task=${t.id}`,
        dedupeKey: `TASK_OVERDUE:${t.id}:${dueDay}`,
      });
    }
  }
  if (on('EXAM_SOON')) {
    for (const e of store.exams.map((x) => toExamSummary(store, x, now, tz))) {
      if (e.daysUntil < 0 || e.daysUntil > EXAM_DAYS || Date.parse(e.startsAt) <= nowMs) continue;
      const { date, time } = localParts(e.startsAt, tz);
      const when = e.daysUntil === 0 ? 'today' : e.daysUntil === 1 ? 'tomorrow' : `in ${e.daysUntil} days`;
      const prep =
        e.prep.total === 0
          ? 'No topics listed yet · add them to track your prep'
          : `${e.prep.done} of ${e.prep.total} topics ready`;
      drafts.push({
        type: 'EXAM_SOON',
        title: `${e.title} is ${when}`,
        body: withContext(e.courseCode ?? e.courseName, `${formatDay(date)} at ${time} · ${prep}`),
        link: `/app/academics/exams/${e.id}`,
        dedupeKey: `EXAM_SOON:${e.id}:${date}`,
      });
    }
  }
  if (on('ATTENDANCE_AT_RISK')) {
    const current = store.semesters.find((s) => s.current);
    const courses = current ? store.courses.filter((c) => c.semesterId === current.id) : [];
    for (const c of courses) {
      const a = courseAttendance(store, c, settings.defaultAttendanceTarget);
      if (a.status !== 'SAFE' && a.status !== 'AT_RISK' && a.status !== 'BELOW') continue;
      const subject = `ATTENDANCE:${c.id}`;
      const previous = store.notificationStates[subject];
      if (previous === a.status) continue;
      store.notificationStates[subject] = a.status;
      if (!attendanceWorsened(previous, a.status)) continue;
      const name = a.courseCode ?? a.courseName;
      const pct = a.percentage === null ? '' : `${percent(a.percentage)} · `;
      const target = a.target === null ? 'your target' : percent(a.target);
      const need = a.needToAttend ?? 0;
      const canMiss = a.canMiss ?? 0;
      drafts.push({
        type: 'ATTENDANCE_AT_RISK',
        title:
          a.status === 'BELOW' ? `${name} attendance is below your target` : `${name} attendance is at risk`,
        body:
          a.status === 'BELOW'
            ? `${pct}attend the next ${need === 1 ? 'class' : `${need} classes`} to get back to ${target}`
            : `${pct}${canMiss <= 0 ? 'you can’t miss another class' : 'you can miss only 1 more class'} and stay at ${target}`,
        link: `/app/academics/courses/${c.id}`,
        dedupeKey: `ATTENDANCE_AT_RISK:${c.id}:${previous ?? 'NEW'}>${a.status}:${nowMs}`,
      });
    }
  }
  if (on('HACKATHON_DEADLINE')) {
    for (const h of store.hackathons.map((x) => toHackathon(store, x, now, tz))) {
      if (h.past || !h.deadline || h.deadline.missed || !inWindow(h.deadline.at)) continue;
      drafts.push({
        type: 'HACKATHON_DEADLINE',
        title: h.name,
        body: hackathonDeadlineReason(h.deadline.kind, h.deadline.at, false, today, tz),
        link: `/app/developer/hackathons/${h.id}`,
        dedupeKey: `HACKATHON_DEADLINE:${h.id}:${h.deadline.kind}:${localParts(h.deadline.at, tz).date}`,
      });
    }
  }
  const open = store.internships.filter((a) => stepMatters(a.status));
  if (on('INTERNSHIP_DEADLINE')) {
    for (const a of open.filter((x) => deadlineMatters(x.status) && inWindow(x.deadlineAt))) {
      drafts.push({
        type: 'INTERNSHIP_DEADLINE',
        title: `${a.role} at ${a.company}`,
        body: applyByReason(a.deadlineAt!, false, today, tz),
        link: `/app/developer/internships/${a.id}`,
        dedupeKey: `INTERNSHIP_DEADLINE:${a.id}:${localParts(a.deadlineAt!, tz).date}`,
      });
    }
  }
  if (on('INTERNSHIP_STEP')) {
    const tomorrow = addDays(today, 1);
    for (const a of open.filter((x) => x.nextStepAt && localParts(x.nextStepAt, tz).date === tomorrow)) {
      const step = a.nextStep?.trim() || 'Next step';
      drafts.push({
        type: 'INTERNSHIP_STEP',
        title: `${a.role} at ${a.company}`,
        body: `${step} tomorrow at ${localParts(a.nextStepAt!, tz).time}`,
        link: `/app/developer/internships/${a.id}`,
        dedupeKey: `INTERNSHIP_STEP:${a.id}:${Math.floor(Date.parse(a.nextStepAt!) / 1000)}`,
      });
    }
  }

  const known = new Set(store.notifications.map((n) => n.dedupeKey));
  let created = 0;
  for (const d of drafts) {
    if (known.has(d.dedupeKey)) continue;
    known.add(d.dedupeKey);
    store.notifications.push({
      id: crypto.randomUUID(),
      type: d.type,
      title: clip(d.title, TITLE_MAX),
      body: clip(d.body, 500),
      link: d.link,
      read: false,
      createdAt: now.toISOString(),
      readAt: null,
      dedupeKey: d.dedupeKey,
    });
    created += 1;
  }
  return created;
}

/** Newest first, as NotificationService sorts them. */
export function newestFirst(a: StoredNotification, b: StoredNotification): number {
  return b.createdAt.localeCompare(a.createdAt) || (a.id < b.id ? 1 : -1);
}

export function toNotification({ dedupeKey: _key, ...n }: StoredNotification): Notification {
  return n;
}
