import type {
  Insight,
  InsightFact,
  InsightSeverity,
  InsightSource,
  InsightWindow,
  Insights,
  QuietRule,
} from '@/features/insights/types';
import type { SettingsRequest } from '@/features/settings/types';
import { addDays, daysBetween, formatDay, localParts, todayIn, zonedToInstant } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { courseAttendance } from './attendance';
import { isOpen, toExamSummary } from './coursework';
import { toHackathon } from './hackathons';
import { analytics } from './internships';

/** Insights for the mock API: a port of InsightRules.java and InsightService.java. */

const DAY_MS = 86_400_000;
const PREP_DAYS = 14;
const STUDY_DAYS = 10;
const AHEAD_DAYS = 7;
const CLASH_DAYS = 14;
const CHART_DAYS = 14;
const STALL_DAYS = 14;
const MAX_SOURCES = 10;

const RULES = [
  ['BUSY_DAY_CLASH', 'Busy days that clash', 'cross'],
  ['EXAM_PREP_GAP', 'Exam prep', 'academics'],
  ['EXAM_STUDY_TIME', 'Study time before exams', 'cross'],
  ['ATTENDANCE_DROP', 'Attendance trend', 'academics'],
  ['DEADLINE_CLUSTER', 'Deadline clusters', 'planner'],
  ['CARRIED_OVER', 'Tasks carried over', 'planner'],
  ['TASK_COMPLETION', 'Task completion', 'planner'],
  ['ON_TIME_SUBMISSIONS', 'On-time submissions', 'academics'],
  ['STALLED_PROJECT', 'Project momentum', 'developer'],
  ['INTERNSHIP_RESPONSE', 'Internship responses', 'developer'],
  ['GITHUB_TREND', 'GitHub activity', 'developer'],
] as const;
type Rule = (typeof RULES)[number][0];
const RULE = Object.fromEntries(
  RULES.map(([id, title, domain], i) => [id, { title, domain, order: i }]),
) as Record<Rule, { title: string; domain: Insight['domain']; order: number }>;
const SEVERITY: InsightSeverity[] = ['WARN', 'INFO', 'GOOD'];

const fact = (label: string, value: string | number): InsightFact => ({ label, value: String(value) });
const percentInt = (part: number, whole: number) => Math.floor((200 * part + whole) / (2 * whole));
const percent1 = (part: number, whole: number) => Math.round((part * 1000) / whole) / 10;
const pct = (n: number) => `${Number(n.toFixed(1))}%`;
const longDay = (date: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  ) + formatDay(date).slice(3);
const monthName = (date: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const range = (from: string, to: string) =>
  from === to
    ? `${Number(to.slice(8))} ${monthName(to)}`
    : `${Number(from.slice(8))}–${Number(to.slice(8))} ${monthName(to)}`;
const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export function buildInsights(
  store: AcademicStore,
  settings: SettingsRequest,
  window: InsightWindow,
  now: Date = new Date(),
): Insights {
  const tz = settings.timezone;
  const nowMs = now.getTime();
  const today = todayIn(tz, now);
  const dayOf = (iso: string) => localParts(iso, tz).date;
  const startOf = (date: string) => Date.parse(zonedToInstant(date, '00:00', tz));
  let from: string;
  if (window === 'WEEK') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    const back = settings.weekStart === 'SUN' ? dow : (dow + 6) % 7;
    from = addDays(today, -back);
  } else {
    from = `${today.slice(0, 8)}01`;
  }
  const phrase = window === 'WEEK' ? 'this week' : 'this month';
  const insights: Insight[] = [];
  const quiet: QuietRule[] = [];
  const add = (
    rule: Rule,
    subject: string | null,
    severity: InsightSeverity,
    text: string,
    evidence: Insight['evidence'],
    sources: InsightSource[],
    link: string,
  ) =>
    insights.push({
      id: subject ? `${rule}:${subject}` : rule,
      rule,
      domain: RULE[rule].domain,
      severity,
      text,
      evidence,
      sources: sources.slice(0, MAX_SOURCES),
      moreSources: Math.max(0, sources.length - MAX_SOURCES),
      link,
    });
  const silent = (rule: Rule, reason: string) => quiet.push({ rule, title: RULE[rule].title, reason });

  const courseLabel = (id: string | null) => {
    const c = id ? store.courses.find((x) => x.id === id) : undefined;
    return c ? (c.code ?? c.name) : null;
  };
  const taskSource = (t: { id: string; title: string }): InsightSource => ({
    kind: 'task',
    id: t.id,
    label: t.title,
    link: `/app/planner/tasks?task=${t.id}`,
  });
  const assignmentSource = (a: { id: string; title: string; courseId: string }): InsightSource => {
    const course = courseLabel(a.courseId);
    return {
      kind: 'assignment',
      id: a.id,
      label: course ? `${a.title} · ${course}` : a.title,
      link: `/app/academics/assignments?course=${a.courseId}`,
    };
  };
  const exams = store.exams.map((e) => toExamSummary(store, e, now, tz)).filter((e) => e.daysUntil >= 0);
  const examSource = (e: (typeof exams)[number]): InsightSource => {
    const course = e.courseCode ?? e.courseName;
    return {
      kind: 'exam',
      id: e.id,
      label: course ? `${e.title} · ${course}` : e.title,
      link: `/app/academics/exams/${e.id}`,
    };
  };

  const windowTasks = store.tasks.filter(
    (t) => t.plannedFor && t.plannedFor >= from && t.plannedFor <= today,
  );
  const deadlinesByDay = (first: string, last: string) => {
    const byDay = new Map<string, InsightSource[]>();
    const put = (iso: string, s: InsightSource) => {
      const d = dayOf(iso);
      if (Date.parse(iso) < nowMs || d < first || d > last) return;
      byDay.set(d, [...(byDay.get(d) ?? []), s]);
    };
    for (const a of store.assignments.filter((x) => isOpen(x.status))) put(a.dueAt, assignmentSource(a));
    for (const t of store.tasks.filter((x) => x.status !== 'DONE' && x.dueAt)) put(t.dueAt!, taskSource(t));
    return new Map([...byDay].sort(([a], [b]) => a.localeCompare(b)));
  };

  // ── across domains: busy days that clash
  {
    const last = addDays(today, CLASH_DAYS - 1);
    const hackathons = store.hackathons.map((h) => toHackathon(store, h, now, tz)).filter((h) => !h.past);
    let found = 0;
    for (const [day, deadlines] of deadlinesByDay(today, last)) {
      if (deadlines.length < 2 || found >= 2) continue;
      const examsThatDay = exams.filter((e) => Date.parse(e.startsAt) > nowMs && dayOf(e.startsAt) === day);
      const running = hackathons.filter(
        (h) => h.startsOn !== null && day >= h.startsOn && day <= (h.endsOn ?? h.startsOn),
      );
      if (examsThatDay.length === 0 && running.length === 0) continue;
      found += 1;
      const also = [...examsThatDay.map((e) => e.title), ...running.map((h) => h.name)];
      add(
        'BUSY_DAY_CLASH',
        day,
        'WARN',
        `${longDay(day)} has ${deadlines.length} deadlines and ${also.join(' and ')}.`,
        {
          from: day,
          to: day,
          facts: [
            fact('Deadlines', deadlines.length),
            fact('Exams', examsThatDay.length),
            fact('Hackathons', running.length),
          ],
          formula:
            'open assignments and tasks due that day, plus exams on it and hackathons running through it',
          note: null,
        },
        [
          ...deadlines,
          ...examsThatDay.map(examSource),
          ...running.map((h) => ({
            kind: 'hackathon',
            id: h.id,
            label: h.name,
            link: `/app/developer/hackathons/${h.id}`,
          })),
        ],
        `/app/planner/calendar?date=${day}`,
      );
    }
  }

  // ── academics: exam prep gap
  {
    const until = startOf(addDays(today, PREP_DAYS + 1));
    const behind = exams
      .filter((e) => Date.parse(e.startsAt) > nowMs && Date.parse(e.startsAt) < until)
      .filter((e) => e.prep.total > 0 && e.prep.done * 2 < e.prep.total)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (behind.length > 0) {
      const list = behind
        .slice(0, 3)
        .map((e) => `${e.title} (${e.prep.done} of ${e.prep.total} topics)`)
        .join(', ');
      const more = behind.length > 3 ? ` and ${behind.length - 3} more` : '';
      add(
        'EXAM_PREP_GAP',
        null,
        'WARN',
        `${behind.length === 1 ? '1 exam' : `${behind.length} exams`} in the next ${PREP_DAYS} days ${
          behind.length === 1 ? 'is' : 'are'
        } less than half prepared: ${list}${more}.`,
        {
          from: today,
          to: addDays(today, PREP_DAYS),
          facts: behind.map((e) =>
            fact(`${e.title} · ${formatDay(dayOf(e.startsAt))}`, `${e.prep.done} of ${e.prep.total} topics`),
          ),
          formula: `topics ticked off ÷ topics listed, for exams in the next ${PREP_DAYS} days`,
          note: null,
        },
        behind.map(examSource),
        behind.length === 1 ? `/app/academics/exams/${behind[0]!.id}` : '/app/academics/exams',
      );
    }
  }

  // ── across domains: study time before exams
  {
    const until = startOf(addDays(today, STUDY_DAYS + 1));
    exams
      .filter((e) => Date.parse(e.startsAt) > nowMs && Date.parse(e.startsAt) < until)
      .filter((e) => e.prep.total > e.prep.done)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 3)
      .forEach((e) => {
        const examDay = dayOf(e.startsAt);
        const days = daysBetween(today, examDay);
        const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
        const planned = store.tasks
          .filter((t) => t.examId === e.id && t.status !== 'DONE' && t.plannedFor !== null)
          .filter((t) => t.plannedFor! >= today && t.plannedFor! <= examDay)
          .sort((a, b) => a.plannedFor!.localeCompare(b.plannedFor!));
        const minutes = planned.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0);
        const unestimated = planned.filter((t) => t.estimatedMinutes === null).length;
        const open = e.prep.total - e.prep.done;
        const topics = `${open} ${open === 1 ? 'topic' : 'topics'} still to go`;
        add(
          'EXAM_STUDY_TIME',
          e.id,
          planned.length === 0 ? 'WARN' : 'INFO',
          planned.length === 0
            ? `No study time planned before ${e.title} ${when}, with ${topics}.`
            : `${planned.length} ${planned.length === 1 ? 'study session' : 'study sessions'}${
                minutes > 0 ? ` (${duration(minutes)})` : ''
              } planned before ${e.title} ${when}, for ${topics}.`,
          {
            from: today,
            to: examDay,
            facts: [
              fact('Study tasks', planned.length),
              fact('Estimated', minutes > 0 ? duration(minutes) : '—'),
              fact('Without an estimate', unestimated),
              fact('Topics to go', open),
            ],
            formula: 'open tasks linked to the exam and planned from today to the exam day',
            note:
              planned.length === 0 ? 'The exam page can spread its topics over the days before it.' : null,
          },
          [examSource(e), ...planned.map(taskSource)],
          `/app/academics/exams/${e.id}`,
        );
      });
  }

  // ── academics: attendance trend
  {
    const current = store.semesters.find((s) => s.current);
    const courses = current ? store.courses.filter((c) => c.semesterId === current.id) : [];
    if (courses.length > 0) {
      let enough = 0;
      const drops: {
        id: string;
        name: string;
        before: number;
        now: number;
        cb: number;
        ab: number;
        cn: number;
        an: number;
        risk: boolean;
      }[] = [];
      for (const c of courses) {
        const a = courseAttendance(store, c, settings.defaultAttendanceTarget);
        const earlier = store.records.filter((r) => r.courseId === c.id && r.heldOn < from);
        const cb =
          c.baselineConducted + earlier.filter((r) => r.status === 'PRESENT' || r.status === 'ABSENT').length;
        const ab = c.baselineAttended + earlier.filter((r) => r.status === 'PRESENT').length;
        if (a.conducted - cb < 2 || cb === 0) continue;
        enough += 1;
        const before = percent1(ab, cb);
        const nowPct = percent1(a.attended, a.conducted);
        if (before - nowPct >= 3) {
          drops.push({
            id: c.id,
            name: c.code ?? c.name,
            before,
            now: nowPct,
            cb,
            ab,
            cn: a.conducted,
            an: a.attended,
            risk: a.status === 'BELOW' || a.status === 'AT_RISK',
          });
        }
      }
      if (enough === 0) {
        silent('ATTENDANCE_DROP', `Needs 2 classes marked in a course ${phrase} to compare.`);
      }
      drops
        .sort((a, b) => b.before - b.now - (a.before - a.now))
        .slice(0, 3)
        .forEach((d) =>
          add(
            'ATTENDANCE_DROP',
            d.id,
            d.risk ? 'WARN' : 'INFO',
            `${d.name} attendance fell from ${pct(d.before)} to ${pct(d.now)} ${phrase}.`,
            {
              from,
              to: today,
              facts: [
                fact('At the start', `${pct(d.before)} (${d.ab} of ${d.cb})`),
                fact('Now', `${pct(d.now)} (${d.an} of ${d.cn})`),
                fact('Classes since', d.cn - d.cb),
              ],
              formula: `attended ÷ conducted (cancelled classes don't count), on ${from} and now`,
              note: null,
            },
            [{ kind: 'course', id: d.id, label: d.name, link: `/app/academics/courses/${d.id}` }],
            `/app/academics/courses/${d.id}`,
          ),
        );
    }
  }

  // ── planner: deadline cluster
  {
    const last = addDays(today, AHEAD_DAYS - 1);
    const byDay = deadlinesByDay(today, last);
    const total = [...byDay.values()].reduce((n, l) => n + l.length, 0);
    if (total < 3) {
      silent(
        'DEADLINE_CLUSTER',
        `Needs 3 deadlines in the next 7 days to look for a cluster; you have ${total}.`,
      );
    } else {
      const [day, list] = [...byDay].reduce((best, e) => (e[1].length > best[1].length ? e : best));
      if (list.length >= 2 && list.length * 10 >= total * 4) {
        add(
          'DEADLINE_CLUSTER',
          day,
          list.length >= 3 ? 'WARN' : 'INFO',
          `${longDay(day)} holds ${list.length} of your ${total} deadlines in the next 7 days.`,
          {
            from: today,
            to: last,
            facts: [...byDay].map(([d, l]) => fact(formatDay(d), l.length)),
            formula:
              'open assignments and tasks due on each day, in your timezone; a cluster is a day with at least 2 of them and 40% of the total',
            note: null,
          },
          list,
          `/app/planner/calendar?date=${day}`,
        );
      }
    }
  }

  // ── planner: carried over
  {
    const open = windowTasks
      .filter((t) => t.status !== 'DONE' && t.plannedFor! < today)
      .sort((a, b) => a.plannedFor!.localeCompare(b.plannedFor!));
    if (open.length >= 2) {
      add(
        'CARRIED_OVER',
        null,
        open.length >= 5 ? 'WARN' : 'INFO',
        `${open.length} tasks planned for earlier days ${phrase} are still open.`,
        {
          from,
          to: addDays(today, -1),
          facts: [fact('Still open', open.length), fact('Oldest', formatDay(open[0]!.plannedFor!))],
          formula: `open tasks planned for a day from ${from} to yesterday`,
          note: 'Move them to a new day or mark them done.',
        },
        open.map(taskSource),
        '/app/planner/tasks',
      );
    }
  }

  // ── planner: task completion
  {
    const planned = windowTasks.length;
    if (planned < 5) {
      silent('TASK_COMPLETION', `Needs 5 tasks planned for days ${phrase}; you have ${planned}.`);
    } else {
      const done = windowTasks.filter((t) => t.status === 'DONE').length;
      const rate = percentInt(done, planned);
      add(
        'TASK_COMPLETION',
        null,
        rate >= 80 ? 'GOOD' : rate >= 50 ? 'INFO' : 'WARN',
        `You completed ${done} of ${planned} tasks planned ${phrase} (${rate}%).`,
        {
          from,
          to: today,
          facts: [fact('Planned', planned), fact('Done', done), fact('Rate', `${rate}%`)],
          formula: `done ÷ planned, for tasks planned for a day from ${from} to today`,
          note: null,
        },
        [...windowTasks]
          .sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'))
          .map(taskSource),
        `/app/planner/calendar?${window === 'MONTH' ? 'view=month&' : ''}date=${from}`,
      );
    }
  }

  // ── academics: on-time submissions
  {
    const fromMs = startOf(from);
    const handedIn = store.assignments
      .filter((a) => Date.parse(a.dueAt) >= fromMs && Date.parse(a.dueAt) < nowMs && !isOpen(a.status))
      .map((a) => ({ a, at: a.submittedAt ?? a.completedAt }))
      .filter((x) => x.at !== null);
    if (handedIn.length < 3) {
      silent(
        'ON_TIME_SUBMISSIONS',
        `Needs 3 assignments due and handed in ${phrase}; you have ${handedIn.length}.`,
      );
    } else {
      const late = handedIn.filter((x) => Date.parse(x.at!) > Date.parse(x.a.dueAt));
      const onTime = handedIn.length - late.length;
      add(
        'ON_TIME_SUBMISSIONS',
        null,
        late.length === 0 ? 'GOOD' : late.length * 2 >= handedIn.length ? 'WARN' : 'INFO',
        `${onTime} of ${handedIn.length} assignments due ${phrase} were handed in on time (${percentInt(onTime, handedIn.length)}%).`,
        {
          from,
          to: today,
          facts: [fact('On time', onTime), fact('Late', late.length)],
          formula: `handed in at or before the deadline ÷ handed in, for assignments due from ${from} to now`,
          note: null,
        },
        [...late, ...handedIn.filter((x) => !late.includes(x))].map((x) => assignmentSource(x.a)),
        '/app/academics/assignments',
      );
    }
  }

  // ── developer: stalled projects
  {
    const cutoff = nowMs - STALL_DAYS * DAY_MS;
    store.projects
      .filter((p) => p.status === 'DEVELOPMENT')
      .map((p) => {
        const ms = store.milestones.filter((m) => m.projectId === p.id);
        const lastDone = ms
          .map((m) => m.doneAt)
          .filter((d): d is string => d !== null)
          .sort()
          .at(-1);
        return {
          p,
          open: ms.filter((m) => !m.doneAt).length,
          last: lastDone ?? p.createdAt,
          anyDone: !!lastDone,
        };
      })
      .filter((x) => x.open > 0 && Date.parse(x.last) < cutoff)
      .sort((a, b) => a.last.localeCompare(b.last))
      .slice(0, 3)
      .forEach(({ p, open, last, anyDone }) => {
        const days = daysBetween(dayOf(last), today);
        const link = `/app/developer/projects/${p.id}`;
        add(
          'STALLED_PROJECT',
          p.id,
          'INFO',
          anyDone
            ? `No milestone finished on ${p.name} in ${days} days.`
            : `No milestone finished on ${p.name} since you added it ${days} days ago.`,
          {
            from: dayOf(last),
            to: today,
            facts: [
              fact('Open milestones', open),
              fact(anyDone ? 'Last finished' : 'Added', formatDay(dayOf(last))),
            ],
            formula: `days since the latest finished milestone (or since the project was added); shown after ${STALL_DAYS}`,
            note: null,
          },
          [{ kind: 'project', id: p.id, label: p.name, link }],
          link,
        );
      });
  }

  // ── developer: internship responses
  if (store.internships.length > 0) {
    const thisMonth = today.slice(0, 7);
    const lastMonthStart = addDays(`${thisMonth}-01`, -1).slice(0, 7);
    const now = analytics(store, thisMonth).responseRate;
    const before = analytics(store, lastMonthStart).responseRate;
    if (now.applied < 3 || before.applied < 3) {
      silent(
        'INTERNSHIP_RESPONSE',
        `Needs 3 applications sent in each of this month and last; you have ${now.applied} and ${before.applied}.`,
      );
    } else {
      const thisName = monthName(`${thisMonth}-01`);
      const lastName = monthName(`${lastMonthStart}-01`);
      add(
        'INTERNSHIP_RESPONSE',
        null,
        'INFO',
        `${pct(percent1(now.responded, now.applied))} of applications sent in ${thisName} have had a response, vs ${pct(
          percent1(before.responded, before.applied),
        )} of those sent in ${lastName}.`,
        {
          from: `${lastMonthStart}-01`,
          to: today,
          facts: [
            fact(thisName, `${now.responded} of ${now.applied}`),
            fact(lastName, `${before.responded} of ${before.applied}`),
          ],
          formula:
            'responded / applied, for applications by the month they were sent; a response is an assessment, interview, offer or rejection',
          note: 'Applications sent recently have had less time to hear back.',
        },
        [
          {
            kind: 'internships',
            id: null,
            label: 'Internship applications',
            link: '/app/developer/internships',
          },
        ],
        '/app/developer/internships',
      );
    }
  }

  // ── developer: GitHub (saved data only)
  if (store.github) {
    const calendar = store.github.user.calendar;
    if (!calendar) {
      silent('GITHUB_TREND', 'Needs the contribution calendar (a GitHub token on the server).');
    } else {
      const thisStart = `${today.slice(0, 8)}01`;
      const lastStart = `${addDays(thisStart, -1).slice(0, 8)}01`;
      let lastEnd = addDays(lastStart, Number(today.slice(8)) - 1);
      if (lastEnd >= thisStart) lastEnd = addDays(thisStart, -1);
      const sum = (a: string, b: string) =>
        calendar.days.filter((d) => d.date >= a && d.date <= b).reduce((n, d) => n + d.count, 0);
      const nowCount = sum(thisStart, today);
      const before = sum(lastStart, lastEnd);
      if (before === 0 || nowCount + before < 5) {
        silent(
          'GITHUB_TREND',
          `Needs public contributions in both months (at least 5 together); you have ${nowCount} this month and ${before} in the same days of last month.`,
        );
      } else {
        const change = nowCount > before ? 'up from' : nowCount < before ? 'down from' : 'the same as';
        add(
          'GITHUB_TREND',
          null,
          nowCount > before ? 'GOOD' : 'INFO',
          `${nowCount} public contributions in ${range(thisStart, today)}, ${change} ${before} in ${range(lastStart, lastEnd)}.`,
          {
            from: thisStart,
            to: today,
            facts: [fact(range(thisStart, today), nowCount), fact(range(lastStart, lastEnd), before)],
            formula:
              "public contributions on the same days of each month, from GitHub's contribution calendar",
            note: `From GitHub, saved ${store.github.fetchedAt}.`,
          },
          [
            {
              kind: 'github',
              id: null,
              label: 'GitHub contribution calendar',
              link: '/app/developer/github',
            },
          ],
          '/app/developer/github',
        );
      }
    }
  }

  // ── charts
  const tasksPerDay: Insights['charts']['tasksPerDay'] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    tasksPerDay.push({
      date: d,
      planned: windowTasks.filter((t) => t.plannedFor === d).length,
      done: store.tasks.filter((t) => t.status === 'DONE' && t.completedAt && dayOf(t.completedAt) === d)
        .length,
    });
  }
  const ahead = deadlinesByDay(today, addDays(today, CHART_DAYS - 1));
  const deadlinesPerDay: Insights['charts']['deadlinesPerDay'] = [];
  for (let i = 0; i < CHART_DAYS; i++) {
    const d = addDays(today, i);
    deadlinesPerDay.push({
      date: d,
      deadlines: ahead.get(d)?.length ?? 0,
      exams: exams.filter((e) => Date.parse(e.startsAt) > nowMs && dayOf(e.startsAt) === d).length,
    });
  }

  const ranked = insights
    .map((ins, i) => ({ ins, i }))
    .sort(
      (a, b) =>
        SEVERITY.indexOf(a.ins.severity) - SEVERITY.indexOf(b.ins.severity) ||
        RULE[a.ins.rule as Rule].order - RULE[b.ins.rule as Rule].order ||
        a.i - b.i,
    )
    .map((x) => x.ins);
  return { window, from, to: today, insights: ranked, quiet, charts: { tasksPerDay, deadlinesPerDay } };
}
