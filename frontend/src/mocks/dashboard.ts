import type { AttentionItem, Dashboard } from '@/features/dashboard/types';
import { startOfWeek } from '@/features/planner/calendarDates';
import type { SettingsRequest } from '@/features/settings/types';
import { addDays, daysBetween, formatDay, localParts, todayIn, zonedToInstant } from '@/lib/dates';
import { summarize, type AcademicStore } from './academics';
import { courseAttendance } from './attendance';
import { isOpen, toExamSummary } from './coursework';
import { githubSummary } from './github';
import { toHackathon } from './hackathons';
import { deadlineMatters, stepMatters } from './internships';
import { toGoal } from './learning';

/** Home's aggregate for the mock API: a port of DashboardService.java, PriorityScorer.java and Streaks.java. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PRIORITY: Record<string, number> = { HIGH: 15, MEDIUM: 8, LOW: 0 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const scorer = {
  overdue: (priority: string, overdueMs: number) =>
    clamp(60 + PRIORITY[priority]! + Math.min(25, Math.max(0, Math.floor(overdueMs / DAY)) * 5)),
  dueSoon: (priority: string, leftMs: number) =>
    clamp(40 + PRIORITY[priority]! + (leftMs <= 6 * HOUR ? 25 : leftMs <= 24 * HOUR ? 15 : 5)),
  belowTarget: (percentage: number, target: number) =>
    clamp(55 + Math.min(25, Math.max(1, Math.ceil(target - percentage)) * 5)),
  atRisk: (canMiss: number) => (canMiss <= 0 ? 45 : 35),
  examNeedsPrep: (daysUntil: number, pct: number | null) =>
    daysUntil >= 0 && daysUntil <= 7 && pct !== null && pct < 50,
  exam: (daysUntil: number, pct: number) => clamp(30 + 4 * (7 - daysUntil) + Math.floor((50 - pct) / 5)),
  hackathonMissed: 45,
  applyByMissed: 40,
  clashNeedsAttention: (daysUntil: number) => daysUntil <= 21,
  clash: (daysUntil: number) => clamp(30 + 2 * (21 - Math.max(0, daysUntil))),
};

/** Streaks.streak: days in a row with a finished task, ending today or yesterday; null below 3. */
export function streak(days: Set<string>, today: string): number | null {
  let day = days.has(today) ? today : addDays(today, -1);
  let length = 0;
  while (days.has(day)) {
    length += 1;
    day = addDays(day, -1);
  }
  return length >= 3 ? length : null;
}

/** DashboardService.deadlineReason. */
export function deadlineReason(dueAt: string, overdue: boolean, today: string, timezone: string): string {
  const { date, time } = localParts(dueAt, timezone);
  if (overdue) {
    const late = daysBetween(date, today);
    if (late <= 0) return `Was due today at ${time}`;
    return late === 1 ? 'Was due yesterday' : `Overdue by ${late} days`;
  }
  if (date === today) return `Due today at ${time}`;
  if (date === addDays(today, 1)) return `Due tomorrow at ${time}`;
  return `Due ${formatDay(date)} at ${time}`;
}

/** DashboardService.hackathonDeadlineReason. */
export function hackathonDeadlineReason(
  kind: 'REGISTRATION' | 'SUBMISSION',
  at: string,
  missed: boolean,
  today: string,
  timezone: string,
): string {
  const what = kind === 'REGISTRATION' ? 'Registration' : 'Submissions';
  if (missed) {
    const ago = daysBetween(localParts(at, timezone).date, today);
    const when = ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;
    return `${what} closed ${when} · update its status`;
  }
  const verb = kind === 'REGISTRATION' ? 'closes' : 'close';
  return `${what} ${verb}${deadlineReason(at, false, today, timezone).slice('Due'.length)}`;
}

/** DashboardService.applyByReason. */
export function applyByReason(at: string, missed: boolean, today: string, timezone: string): string {
  if (missed) {
    const ago = daysBetween(localParts(at, timezone).date, today);
    const when = ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;
    return `Apply-by date passed ${when} · apply or update it`;
  }
  return `Apply by${deadlineReason(at, false, today, timezone).slice('Due'.length)}`;
}

/** DashboardService.clashReason. */
export function clashReason(
  exam: { title: string; on: string },
  startsOn: string,
  endsOn: string | null,
): string {
  const last = endsOn ?? startsOn;
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const where =
    exam.on < startsOn
      ? `${days(daysBetween(exam.on, startsOn))} before it`
      : exam.on > last
        ? `${days(daysBetween(last, exam.on))} after it`
        : 'during it';
  return `${exam.title} on ${formatDay(exam.on)} · ${where}`;
}

const percent = (n: number) => `${Number(n.toFixed(1))}%`;

export function buildDashboard(
  store: AcademicStore,
  settings: SettingsRequest,
  now: Date = new Date(),
): Dashboard {
  const tz = settings.timezone;
  const today = todayIn(tz, now);
  const nowMs = now.getTime();
  const horizon = nowMs + 48 * HOUR;
  const codeOf = (courseId: string | null) => {
    const c = courseId ? store.courses.find((x) => x.id === courseId) : undefined;
    return c ? (c.code ?? c.name) : null;
  };

  const items: AttentionItem[] = [];
  for (const a of store.assignments.filter((x) => isOpen(x.status) && Date.parse(x.dueAt) < horizon)) {
    const due = Date.parse(a.dueAt);
    const overdue = due < nowMs;
    items.push({
      kind: overdue ? 'ASSIGNMENT_OVERDUE' : 'ASSIGNMENT_DUE_SOON',
      refId: a.id,
      title: a.title,
      courseCode: codeOf(a.courseId),
      reason: deadlineReason(a.dueAt, overdue, today, tz),
      score: overdue ? scorer.overdue(a.priority, nowMs - due) : scorer.dueSoon(a.priority, due - nowMs),
      link: `/app/academics/assignments?course=${a.courseId}`,
    });
  }
  for (const t of store.tasks.filter(
    (x) => x.status !== 'DONE' && x.dueAt && Date.parse(x.dueAt) < horizon,
  )) {
    const due = Date.parse(t.dueAt!);
    const overdue = due < nowMs;
    items.push({
      kind: overdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON',
      refId: t.id,
      title: t.title,
      courseCode: codeOf(t.courseId),
      reason: deadlineReason(t.dueAt!, overdue, today, tz),
      score: overdue ? scorer.overdue(t.priority, nowMs - due) : scorer.dueSoon(t.priority, due - nowMs),
      link: '/app/planner/tasks',
    });
  }

  const current = store.semesters.find((s) => s.current);
  const rows = current
    ? store.courses
        .filter((c) => c.semesterId === current.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => courseAttendance(store, c, settings.defaultAttendanceTarget))
    : [];
  for (const a of rows) {
    if (a.status !== 'BELOW' && a.status !== 'AT_RISK') continue;
    const pct = percent(a.percentage!);
    let score: number;
    let reason: string;
    if (a.status === 'BELOW') {
      score = scorer.belowTarget(a.percentage!, a.target!);
      const need = a.needToAttend ?? 0;
      reason = `${pct} · below your ${percent(a.target!)} target; attend the next ${need === 1 ? 'class' : `${need} classes`}`;
    } else {
      const canMiss = a.canMiss ?? 0;
      score = scorer.atRisk(canMiss);
      reason = `${pct}${canMiss <= 0 ? ' · can’t miss another class' : ' · can miss only 1 more'}`;
    }
    items.push({
      kind: 'ATTENDANCE_AT_RISK',
      refId: a.courseId,
      title: a.courseName,
      courseCode: a.courseCode,
      reason,
      score,
      link: `/app/academics/courses/${a.courseId}`,
    });
  }

  const startOfToday = Date.parse(zonedToInstant(today, '00:00', tz));
  for (const e of store.exams.filter((x) => Date.parse(x.startsAt) >= startOfToday)) {
    const s = toExamSummary(store, e, now, tz);
    if (!scorer.examNeedsPrep(s.daysUntil, s.prep.percentage)) continue;
    const when = s.daysUntil === 0 ? 'Today' : s.daysUntil === 1 ? 'Tomorrow' : `In ${s.daysUntil} days`;
    items.push({
      kind: 'EXAM_PREP',
      refId: s.id,
      title: s.title,
      courseCode: s.courseCode ?? s.courseName,
      reason: `${when} · ${s.prep.done} of ${s.prep.total} topics ready`,
      score: scorer.exam(s.daysUntil, s.prep.percentage!),
      link: `/app/academics/exams/${s.id}`,
    });
  }
  const upcoming = store.hackathons.map((h) => toHackathon(store, h, now, tz)).filter((h) => !h.past);
  for (const h of upcoming) {
    const link = `/app/developer/hackathons/${h.id}`;
    if (h.deadline && Date.parse(h.deadline.at) < horizon) {
      const at = Date.parse(h.deadline.at);
      items.push({
        kind: 'HACKATHON_DEADLINE',
        refId: h.id,
        title: h.name,
        courseCode: null,
        reason: hackathonDeadlineReason(h.deadline.kind, h.deadline.at, h.deadline.missed, today, tz),
        score: h.deadline.missed ? scorer.hackathonMissed : scorer.dueSoon('MEDIUM', at - nowMs),
        link,
      });
    }
    if (h.examClashes.length > 0 && h.daysUntil !== null && scorer.clashNeedsAttention(h.daysUntil)) {
      const first = h.examClashes[0]!;
      const more = h.examClashes.length - 1;
      items.push({
        kind: 'HACKATHON_EXAM_CLASH',
        refId: h.id,
        title: h.name,
        courseCode: first.courseCode,
        reason: clashReason(first, h.startsOn!, h.endsOn) + (more > 0 ? ` (+${more} more)` : ''),
        score: scorer.clash(h.daysUntil),
        link,
      });
    }
  }

  const open = store.internships.filter((a) => stepMatters(a.status));
  for (const a of open) {
    if (!deadlineMatters(a.status) || !a.deadlineAt) continue;
    const at = Date.parse(a.deadlineAt);
    if (at >= horizon || at < nowMs - 7 * DAY) continue;
    const missed = at < nowMs;
    items.push({
      kind: 'INTERNSHIP_DEADLINE',
      refId: a.id,
      title: `${a.role} at ${a.company}`,
      courseCode: null,
      reason: applyByReason(a.deadlineAt, missed, today, tz),
      score: missed ? scorer.applyByMissed : scorer.dueSoon('MEDIUM', at - nowMs),
      link: `/app/developer/internships/${a.id}`,
    });
  }

  items.sort((a, b) => b.score - a.score || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));

  const grades = summarize(store);
  const term = grades.semesters.find((s) => s.current);
  const lowest = rows
    .filter((r) => r.percentage !== null && r.conducted > 0)
    .sort((a, b) => a.percentage! - b.percentage!)[0];

  const dayEnd = Date.parse(zonedToInstant(addDays(today, 1), '00:00', tz));
  const openToday = store.tasks.filter(
    (t) =>
      t.status !== 'DONE' &&
      ((t.plannedFor !== null && t.plannedFor <= today) ||
        (t.dueAt !== null && Date.parse(t.dueAt) < dayEnd)),
  ).length;
  const completedDay = (t: { completedAt: string | null }) =>
    t.completedAt ? todayIn(tz, new Date(t.completedAt)) : null;
  const doneToday = store.tasks.filter((t) => t.status === 'DONE' && completedDay(t) === today).length;
  const weekFrom = startOfWeek(today, settings.weekStart);
  const week = store.tasks.filter(
    (t) => t.plannedFor !== null && t.plannedFor >= weekFrom && t.plannedFor <= addDays(weekFrom, 6),
  );
  const doneDays = new Set(
    store.tasks
      .filter((t) => t.status === 'DONE')
      .map(completedDay)
      .filter((d): d is string => d !== null && d > addDays(today, -60) && d <= today),
  );

  return {
    date: today,
    needsAttention: items.slice(0, 8),
    academics:
      current && term
        ? {
            semesterId: current.id,
            semesterName: term.name,
            gpa: term.gpa,
            cgpa: grades.cgpa,
            credits: term.credits,
            lowestAttendance: lowest
              ? {
                  courseId: lowest.courseId,
                  courseName: lowest.courseName,
                  percentage: lowest.percentage!,
                  target: lowest.target,
                }
              : null,
          }
        : null,
    planner: {
      openToday,
      doneToday,
      weekDone: week.filter((t) => t.status === 'DONE').length,
      weekPlanned: week.length,
      streakDays: streak(doneDays, today),
    },
    developer: developerSummary(store, today, upcoming, open, nowMs),
  };
}

/** DashboardService.developer: active projects and the soonest open, dated milestone among them. */
function developerSummary(
  store: AcademicStore,
  today: string,
  upcoming: ReturnType<typeof toHackathon>[],
  applications: AcademicStore['internships'],
  nowMs: number,
): Dashboard['developer'] {
  const step = applications
    .filter((a) => a.nextStepAt !== null && Date.parse(a.nextStepAt) >= nowMs)
    .sort((a, b) => Date.parse(a.nextStepAt!) - Date.parse(b.nextStepAt!))[0];
  const active = store.projects.filter((p) => ['IDEA', 'PLANNING', 'DEVELOPMENT'].includes(p.status));
  const ids = new Set(active.map((p) => p.id));
  const next = store.milestones
    .filter((m) => m.doneAt === null && m.dueOn !== null && ids.has(m.projectId))
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : 0))[0];
  const project = next && active.find((p) => p.id === next.projectId)!;
  const goals = store.learningGoals.filter((g) => g.status === 'ACTIVE');
  const focus = [...goals].sort(
    (a, b) =>
      (a.targetOn === b.targetOn
        ? 0
        : a.targetOn === null
          ? 1
          : b.targetOn === null
            ? -1
            : a.targetOn < b.targetOn
              ? -1
              : 1) || b.createdAt.localeCompare(a.createdAt),
  )[0];
  const focusGoal = focus && toGoal(store, focus);
  const nextHackathon = upcoming
    .filter((h) => h.startsOn !== null)
    .sort((a, b) => (a.startsOn! < b.startsOn! ? -1 : a.startsOn! > b.startsOn! ? 1 : 0))[0];
  return {
    github: githubSummary(store.github, today),
    activeApplications: applications.filter((a) => a.status !== 'SAVED').length,
    nextInternshipStep: step
      ? {
          internshipId: step.id,
          company: step.company,
          role: step.role,
          step: step.nextStep,
          at: step.nextStepAt!,
        }
      : null,
    upcomingHackathons: upcoming.length,
    nextHackathon: nextHackathon
      ? {
          hackathonId: nextHackathon.id,
          name: nextHackathon.name,
          startsOn: nextHackathon.startsOn!,
          endsOn: nextHackathon.endsOn,
          daysUntil: nextHackathon.daysUntil!,
          status: nextHackathon.status,
        }
      : null,
    activeGoals: goals.length,
    focusGoal: focusGoal
      ? {
          goalId: focusGoal.id,
          title: focusGoal.title,
          percentage: focusGoal.progress.percentage,
          nextTopic: focusGoal.nextTopic?.title ?? null,
          targetOn: focusGoal.targetOn,
        }
      : null,
    inDevelopment: active.filter((p) => p.status === 'DEVELOPMENT').length,
    activeProjects: active.length,
    nextMilestone:
      next && project
        ? {
            projectId: project.id,
            projectName: project.name,
            title: next.title,
            dueOn: next.dueOn!,
            overdue: next.dueOn! < today,
          }
        : null,
  };
}
