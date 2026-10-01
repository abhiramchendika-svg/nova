import { isoWeekday } from '@/features/planner/calendarDates';
import type { CalendarItem, CalendarItemType, CalendarRange, DayLoad } from '@/features/planner/types';
import { addDays, daysBetween, localParts, zonedToInstant } from '@/lib/dates';
import type { AcademicStore } from './academics';
import { isOpen } from './coursework';

/** The calendar feed for the mock API: a port of CalendarService.java and CalendarRules.java. */

const DEFAULT_TASK_MINUTES = 30;
const TYPE_ORDER: CalendarItemType[] = ['CLASS', 'EXAM', 'ASSIGNMENT_DUE', 'TASK', 'TASK_DUE'];

/** Java's String order (by code unit), not the locale's. */
const text = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
const toMin = (hhmm: string) =>
  hhmm === '24:00' ? 1440 : Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** CalendarRules.endOf: the end on the start's day, "24:00" if it runs past midnight. */
const endOf = (start: string, minutes: number) => {
  const end = toMin(start) + minutes;
  return end >= 1440 ? '24:00' : hhmm(end);
};

/** CalendarRules.classDates: dates in [from, to] on an ISO weekday, inside the term. */
export function classDates(
  dayOfWeek: number,
  from: string,
  to: string,
  termStart: string | null,
  termEnd: string | null,
): string[] {
  const first = termStart && termStart > from ? termStart : from;
  const last = termEnd && termEnd < to ? termEnd : to;
  const dates: string[] = [];
  for (let d = addDays(first, (dayOfWeek - isoWeekday(first) + 7) % 7); d <= last; d = addDays(d, 7))
    dates.push(d);
  return dates;
}

export function buildCalendar(
  store: AcademicStore,
  from: string,
  to: string,
  timezone: string,
): CalendarRange {
  const start = Date.parse(zonedToInstant(from, '00:00', timezone));
  const end = Date.parse(zonedToInstant(addDays(to, 1), '00:00', timezone));
  const within = (iso: string) => Date.parse(iso) >= start && Date.parse(iso) < end;
  const local = (iso: string) => localParts(iso, timezone);

  const items: CalendarItem[] = [];
  const load = new Map<string, DayLoad>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    load.set(d, { date: d, deadlines: 0, exams: 0, classMinutes: 0, plannedTaskMinutes: 0 });
  }
  const add = (
    item: Omit<CalendarItem, 'courseCode' | 'courseName' | 'colorHue' | 'title'> & { title: string | null },
  ) => {
    const course = item.courseId ? store.courses.find((c) => c.id === item.courseId) : undefined;
    items.push({
      ...item,
      title: item.title ?? course?.name ?? 'Class',
      courseCode: course?.code ?? null,
      courseName: course?.name ?? null,
      colorHue: course?.colorHue ?? null,
    });
  };
  const base = { done: false, location: null, kind: null, priority: null } as const;

  const term = store.semesters.find((s) => s.current);
  if (term) {
    const termCourses = new Set(store.courses.filter((c) => c.semesterId === term.id).map((c) => c.id));
    for (const e of store.timetable.filter((x) => termCourses.has(x.courseId))) {
      for (const date of classDates(e.dayOfWeek, from, to, term.startsOn, term.endsOn)) {
        add({
          ...base,
          key: `class:${e.id}:${date}`,
          type: 'CLASS',
          refId: e.id,
          title: null,
          date,
          startTime: e.startsAt,
          endTime: e.endsAt,
          courseId: e.courseId,
          location: e.location,
          kind: e.kind,
        });
        load.get(date)!.classMinutes += toMin(e.endsAt) - toMin(e.startsAt);
      }
    }
  }
  for (const x of store.exams.filter((e) => within(e.startsAt))) {
    const { date, time } = local(x.startsAt);
    add({
      ...base,
      key: `exam:${x.id}`,
      type: 'EXAM',
      refId: x.id,
      title: x.title,
      date,
      startTime: time,
      endTime: x.durationMinutes === null ? null : endOf(time, x.durationMinutes),
      courseId: x.courseId,
      location: x.location,
      kind: x.kind,
    });
    load.get(date)!.exams += 1;
  }
  for (const a of store.assignments.filter((x) => isOpen(x.status) && within(x.dueAt))) {
    const { date, time } = local(a.dueAt);
    add({
      ...base,
      key: `assignment:${a.id}`,
      type: 'ASSIGNMENT_DUE',
      refId: a.id,
      title: a.title,
      date,
      startTime: time,
      endTime: null,
      courseId: a.courseId,
      priority: a.priority,
    });
    load.get(date)!.deadlines += 1;
  }
  for (const t of store.tasks.filter(
    (x) => x.plannedFor !== null && x.plannedFor >= from && x.plannedFor <= to,
  )) {
    const done = t.status === 'DONE';
    add({
      ...base,
      key: `task:${t.id}`,
      type: 'TASK',
      refId: t.id,
      title: t.title,
      date: t.plannedFor!,
      startTime: t.plannedStart,
      endTime: t.plannedStart ? endOf(t.plannedStart, t.estimatedMinutes ?? DEFAULT_TASK_MINUTES) : null,
      done,
      courseId: t.courseId,
      priority: t.priority,
    });
    if (!done && t.estimatedMinutes !== null)
      load.get(t.plannedFor!)!.plannedTaskMinutes += t.estimatedMinutes;
  }
  for (const t of store.tasks.filter((x) => x.status !== 'DONE' && x.dueAt !== null && within(x.dueAt))) {
    const { date, time } = local(t.dueAt!);
    load.get(date)!.deadlines += 1;
    if (date === t.plannedFor) continue; // already on that day; the deadline still counts
    add({
      ...base,
      key: `task-due:${t.id}`,
      type: 'TASK_DUE',
      refId: t.id,
      title: t.title,
      date,
      startTime: time,
      endTime: null,
      courseId: t.courseId,
      priority: t.priority,
    });
  }

  // CalendarRules.ORDER: day, untimed first, start time, type, title, key
  items.sort(
    (a, b) =>
      daysBetween(b.date, a.date) ||
      (a.startTime === b.startTime
        ? 0
        : a.startTime === null
          ? -1
          : b.startTime === null
            ? 1
            : a.startTime < b.startTime
              ? -1
              : 1) ||
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      text(a.title, b.title) ||
      text(a.key, b.key),
  );
  return { from, to, timezone, items, load: [...load.values()] };
}
